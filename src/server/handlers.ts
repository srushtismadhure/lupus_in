/**
 * All request handlers, shared between the two deployment targets:
 *  - src/index.ts: a persistent Bun.serve() process (local dev, Docker/Railway/Render/Fly)
 *  - api/*.ts: individual Vercel serverless functions (see api/_lib/adapter.ts)
 *
 * Every handler here is a plain (req: Request) => Promise<Response> function —
 * no framework-specific request/response types — so both entry points can
 * call the exact same code with zero duplication.
 */
import { getFhirConfig } from "../lib/fhir-config.js";
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  createDemoSessionToken,
  DEMO_USERS,
  forbiddenResponse,
  getSessionFromRequest,
  isDemoRole,
  requireRole,
  unauthorizedResponse,
} from "../lib/auth.js";
import { buildPatientResource, mergePatientResource, validatePatientInput, type PatientFormInput } from "../lib/patient-input.js";
import {
  createFhirResource,
  extractIdFromLocation,
  readFhirResource,
  searchFhirResource,
  updateFhirResource,
} from "../lib/fhir-server-client.js";
import { buildClinicianWorklist } from "../lib/worklist.js";
import { referencesPatient } from "../lib/formatters.js";
import {
  buildNurseMntWorklist,
  contactPatient,
  coordinateScheduling,
  createDraftReferral,
  declineReferral,
  documentBarrier,
  getPatientMntState,
  modifyReferral,
  sendForSignature,
  signReferral,
  type MntActionResult,
} from "../lib/mnt.js";
import type { PatientWillingness } from "../lib/mnt-types.js";

const HOP_BY_HOP_RESPONSE_HEADERS = new Set(["content-type", "location", "content-location", "etag", "last-modified"]);
const FORWARDED_REQUEST_HEADERS = ["if-match", "if-none-match", "if-modified-since", "prefer"];
const VERCEL_ROUTE_PARAM_KEYS = ["resource", "id", "patientId", "referralId", "action", "...path"];

export function networkErrorResponse() {
  return Response.json(
    {
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", code: "exception", diagnostics: "The application could not reach the configured FHIR server." }],
    },
    { status: 502, headers: { "Content-Type": "application/fhir+json" } },
  );
}

/**
 * Proxies a request to Medblocks. `fhirSubPath` is the path *after* the public `/fhir` prefix
 * (e.g. `/Patient`), passed in explicitly so callers don't need to agree on a URL prefix.
 */
export async function proxyFhirRequest(req: Request, fhirSubPath: string): Promise<Response> {
  if (!getSessionFromRequest(req)) return unauthorizedResponse();

  const fhirConfig = getFhirConfig();
  const incomingUrl = new URL(req.url);
  const upstreamUrl = new URL(`${fhirConfig.baseUrl}${fhirSubPath || "/"}`);

  const upstreamSearchParams = new URLSearchParams(incomingUrl.search);
  for (const key of VERCEL_ROUTE_PARAM_KEYS) {
    upstreamSearchParams.delete(key);
  }
  upstreamUrl.search = upstreamSearchParams.toString();

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${fhirConfig.bearerToken}`);
  headers.set("Accept", "application/fhir+json");

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  if (hasBody) {
    const incomingContentType = req.headers.get("content-type");
    headers.set("Content-Type", incomingContentType && incomingContentType.trim() ? incomingContentType : "application/fhir+json");
  }

  for (const headerName of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers.get(headerName);
    if (value) headers.set(headerName, value);
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      // @ts-expect-error - required by undici/Bun when streaming a body
      duplex: hasBody ? "half" : undefined,
    });
  } catch (error) {
    console.error("FHIR upstream request failed:", error instanceof Error ? error.message : "unknown error");
    return networkErrorResponse();
  }

  const responseHeaders = new Headers();
  upstreamResponse.headers.forEach((value, key) => {
    if (HOP_BY_HOP_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
  });

  return new Response(upstreamResponse.body, { status: upstreamResponse.status, headers: responseHeaders });
}

function isOperationOutcome(value: unknown): value is fhir4.OperationOutcome {
  return typeof value === "object" && value !== null && (value as { resourceType?: string }).resourceType === "OperationOutcome";
}

function validationErrorOutcome(errors: { field: string; message: string }[]): fhir4.OperationOutcome {
  return {
    resourceType: "OperationOutcome",
    issue: errors.map(error => ({ severity: "error", code: "invalid", diagnostics: error.message, expression: [error.field] })),
  };
}

export async function handleDemoLogin(req: Request): Promise<Response> {
  let body: { role?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine — validated below
  }

  const role = isDemoRole(body.role) ? body.role : null;
  if (!role) return Response.json({ error: "A valid demo role is required." }, { status: 400 });

  const token = createDemoSessionToken(role);
  const user = DEMO_USERS[role];
  return Response.json(
    { authenticated: true, user: { email: user.email, displayName: user.displayName, role } },
    { status: 200, headers: { "Set-Cookie": buildSessionCookie(token) } },
  );
}

export async function handleLogout(): Promise<Response> {
  return Response.json({ ok: true }, { status: 200, headers: { "Set-Cookie": buildClearedSessionCookie() } });
}

export async function handleSession(req: Request): Promise<Response> {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ authenticated: false }, { status: 200 });
  return Response.json(
    { authenticated: true, user: { email: session.email, displayName: session.displayName, role: session.role } },
    { status: 200 },
  );
}

export async function handleCreatePatient(req: Request): Promise<Response> {
  if (!getSessionFromRequest(req)) return unauthorizedResponse();

  let input: Partial<PatientFormInput>;
  try {
    input = (await req.json()) as Partial<PatientFormInput>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const errors = validatePatientInput(input);
  if (errors.length > 0) return Response.json(validationErrorOutcome(errors), { status: 422 });

  const identifierValue = input.identifier?.trim() || crypto.randomUUID();

  if (input.identifier?.trim()) {
    const existing = await searchFhirResource<fhir4.Bundle>(
      "Patient",
      `identifier=${encodeURIComponent(`https://nephra.demo/patient-id|${identifierValue}`)}`,
    );
    if (existing.status === 200 && existing.body?.total && existing.body.total > 0) {
      return Response.json(
        { resourceType: "OperationOutcome", issue: [{ severity: "error", code: "duplicate", diagnostics: "A patient with this identifier already exists." }] },
        { status: 409 },
      );
    }
  }

  const resource = buildPatientResource(input as PatientFormInput, identifierValue);
  const result = await createFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", resource);

  if (result.status !== 201) return Response.json(result.body, { status: result.status });

  const createdId = (isOperationOutcome(result.body) ? null : result.body.id) ?? extractIdFromLocation(result.location);
  return Response.json({ ...result.body, id: createdId }, { status: 201 });
}

export async function handleUpdatePatient(req: Request, patientId: string): Promise<Response> {
  if (!getSessionFromRequest(req)) return unauthorizedResponse();

  let input: Partial<PatientFormInput>;
  try {
    input = (await req.json()) as Partial<PatientFormInput>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const errors = validatePatientInput(input);
  if (errors.length > 0) return Response.json(validationErrorOutcome(errors), { status: 422 });

  const current = await readFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", patientId);
  if (current.status !== 200 || isOperationOutcome(current.body)) {
    return Response.json(current.body, { status: current.status });
  }

  const merged = mergePatientResource(current.body, input as PatientFormInput);
  const ifMatch = req.headers.get("if-match") ?? current.etag ?? undefined;
  const result = await updateFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", patientId, merged, ifMatch);

  if (result.status === 409) {
    return Response.json(
      { resourceType: "OperationOutcome", issue: [{ severity: "error", code: "conflict", diagnostics: "This patient was updated by another process. Refresh and try again." }] },
      { status: 409 },
    );
  }

  return Response.json(result.body, { status: result.status });
}

export async function handleDeactivatePatient(req: Request, patientId: string): Promise<Response> {
  if (!getSessionFromRequest(req)) return unauthorizedResponse();

  const current = await readFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", patientId);
  if (current.status !== 200 || isOperationOutcome(current.body)) {
    return Response.json(current.body, { status: current.status });
  }

  const deactivated: fhir4.Patient = { ...current.body, active: false };
  const result = await updateFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", patientId, deactivated, current.etag ?? undefined);

  return Response.json(result.body, { status: result.status });
}

export async function handleClinicianWorklist(req: Request): Promise<Response> {
  if (!getSessionFromRequest(req)) return unauthorizedResponse();

  try {
    const worklist = await buildClinicianWorklist();
    return Response.json(worklist, { status: 200 });
  } catch (error) {
    console.error("Failed to build clinician worklist:", error instanceof Error ? error.message : "unknown error");
    return networkErrorResponse();
  }
}

export async function handleNurseMntWorklist(req: Request): Promise<Response> {
  if (!getSessionFromRequest(req)) return unauthorizedResponse();

  try {
    const worklist = await buildNurseMntWorklist();
    return Response.json(worklist, { status: 200 });
  } catch (error) {
    console.error("Failed to build MNT worklist:", error instanceof Error ? error.message : "unknown error");
    return networkErrorResponse();
  }
}

function mntActionResponse(result: MntActionResult): Response {
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.referral, { status: 200 });
}

export async function handleGetMntState(req: Request, patientId: string): Promise<Response> {
  if (!getSessionFromRequest(req)) return unauthorizedResponse();

  const patientResult = await readFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", patientId);
  if (patientResult.status !== 200 || isOperationOutcome(patientResult.body)) {
    return Response.json(patientResult.body, { status: patientResult.status });
  }

  const [conditionsResult, observationsResult] = await Promise.all([
    searchFhirResource<fhir4.Bundle>("Condition", `patient=${encodeURIComponent(patientId)}`),
    searchFhirResource<fhir4.Bundle>("Observation", `patient=${encodeURIComponent(patientId)}`),
  ]);

  const conditions = (conditionsResult.body?.entry ?? [])
    .map(entry => entry.resource)
    .filter((r): r is fhir4.Condition => !!r && r.resourceType === "Condition")
    .filter(condition => referencesPatient(condition.subject, patientId));
  const observations = (observationsResult.body?.entry ?? [])
    .map(entry => entry.resource)
    .filter((r): r is fhir4.Observation => !!r && r.resourceType === "Observation")
    .filter(observation => referencesPatient(observation.subject, patientId));

  const state = await getPatientMntState(patientResult.body, conditions, observations);
  return Response.json(state, { status: 200 });
}

export async function handleCreateMntReferral(req: Request): Promise<Response> {
  const session = requireRole(req, "nurse", "clinician");
  if (!session) return getSessionFromRequest(req) ? forbiddenResponse() : unauthorizedResponse();

  let body: {
    patientId?: string;
    reasonDisplay?: string;
    reasonReferenceId?: string;
    reasonReferenceType?: "Condition" | "Observation";
    supportingObservationIds?: string[];
    willingness?: PatientWillingness;
    barriers?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.patientId || !body.reasonDisplay) {
    return Response.json({ error: "patientId and reasonDisplay are required." }, { status: 400 });
  }

  const result = await createDraftReferral({
    patientId: body.patientId,
    reasonReference: body.reasonReferenceId
      ? { reference: `${body.reasonReferenceType ?? "Condition"}/${body.reasonReferenceId}`, display: body.reasonDisplay }
      : { display: body.reasonDisplay },
    supportingInfo: (body.supportingObservationIds ?? []).map(id => ({ reference: `Observation/${id}` })),
    willingness: body.willingness ?? "unknown",
    barriers: body.barriers ?? [],
    preparedByDisplay: session.displayName,
  });

  return mntActionResponse(result);
}

export async function handleSendForSignature(req: Request, serviceRequestId: string): Promise<Response> {
  const session = requireRole(req, "nurse");
  if (!session) return getSessionFromRequest(req) ? forbiddenResponse() : unauthorizedResponse();

  const result = await sendForSignature({ serviceRequestId, nurseDisplay: session.displayName });
  return mntActionResponse(result);
}

export async function handleSignMntReferral(req: Request, serviceRequestId: string): Promise<Response> {
  const session = requireRole(req, "clinician");
  if (!session) return getSessionFromRequest(req) ? forbiddenResponse("Only an authorized clinician can sign this referral.") : unauthorizedResponse();

  let body: { dietitianDisplay?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine
  }

  const result = await signReferral({ serviceRequestId, clinicianDisplay: session.displayName, dietitianDisplay: body.dietitianDisplay });
  return mntActionResponse(result);
}

export async function handleDeclineMntReferral(req: Request, serviceRequestId: string): Promise<Response> {
  const session = requireRole(req, "clinician");
  if (!session) return getSessionFromRequest(req) ? forbiddenResponse("Only an authorized clinician can decline this referral.") : unauthorizedResponse();

  let body: { reason?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.reason) return Response.json({ error: "A decline reason is required." }, { status: 400 });

  const result = await declineReferral({ serviceRequestId, reason: body.reason, clinicianDisplay: session.displayName });
  return mntActionResponse(result);
}

export async function handleModifyMntReferral(req: Request, serviceRequestId: string): Promise<Response> {
  const session = requireRole(req, "clinician");
  if (!session) return getSessionFromRequest(req) ? forbiddenResponse("Only an authorized clinician can modify this referral.") : unauthorizedResponse();

  let body: { reasonText?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await modifyReferral({ serviceRequestId, reasonText: body.reasonText, clinicianDisplay: session.displayName });
  return mntActionResponse(result);
}

export async function handleDocumentBarrier(req: Request, serviceRequestId: string): Promise<Response> {
  const session = requireRole(req, "nurse");
  if (!session) return getSessionFromRequest(req) ? forbiddenResponse() : unauthorizedResponse();

  let body: { barrier?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.barrier) return Response.json({ error: "A barrier description is required." }, { status: 400 });

  const result = await documentBarrier({ serviceRequestId, barrier: body.barrier, nurseDisplay: session.displayName });
  return mntActionResponse(result);
}

export async function handleContactPatient(req: Request, serviceRequestId: string): Promise<Response> {
  const session = requireRole(req, "nurse");
  if (!session) return getSessionFromRequest(req) ? forbiddenResponse() : unauthorizedResponse();

  let body: { outcome?: "reached" | "no-response" | "declined-appointment"; note?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.outcome) return Response.json({ error: "An outcome is required." }, { status: 400 });

  const result = await contactPatient({ serviceRequestId, outcome: body.outcome, note: body.note, nurseDisplay: session.displayName });
  return mntActionResponse(result);
}

export async function handleCoordinateScheduling(req: Request, serviceRequestId: string): Promise<Response> {
  const session = requireRole(req, "nurse");
  if (!session) return getSessionFromRequest(req) ? forbiddenResponse() : unauthorizedResponse();

  let body: { appointmentDate?: string; dietitianDisplay?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await coordinateScheduling({
    serviceRequestId,
    appointmentDate: body.appointmentDate,
    dietitianDisplay: body.dietitianDisplay,
    nurseDisplay: session.displayName,
  });
  return mntActionResponse(result);
}
