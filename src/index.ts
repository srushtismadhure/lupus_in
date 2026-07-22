import { serve } from "bun";
import index from "./index.html";
import { fhirConfig } from "./lib/fhir-config";
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  createDemoSessionToken,
  DEMO_USER,
  getSessionFromRequest,
  unauthorizedResponse,
} from "./lib/auth";
import { buildPatientResource, mergePatientResource, validatePatientInput, type PatientFormInput } from "./lib/patient-input";
import {
  createFhirResource,
  extractIdFromLocation,
  readFhirResource,
  searchFhirResource,
  updateFhirResource,
} from "./lib/fhir-server-client";
import { buildClinicianWorklist } from "./lib/worklist";

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  "content-type",
  "location",
  "content-location",
  "etag",
  "last-modified",
]);

const FORWARDED_REQUEST_HEADERS = ["if-match", "if-none-match", "if-modified-since", "prefer"];

function networkErrorResponse() {
  return Response.json(
    {
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "error",
          code: "exception",
          diagnostics: "The application could not reach the configured FHIR server.",
        },
      ],
    },
    { status: 502, headers: { "Content-Type": "application/fhir+json" } },
  );
}

async function proxyFhirRequest(req: Request): Promise<Response> {
  if (!getSessionFromRequest(req)) return unauthorizedResponse();

  const incomingUrl = new URL(req.url);
  const upstreamPath = incomingUrl.pathname.replace(/^\/fhir/, "") || "/";
  const upstreamUrl = new URL(`${fhirConfig.baseUrl}${upstreamPath}`);
  upstreamUrl.search = incomingUrl.search;

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
  for (const [key, value] of upstreamResponse.headers) {
    if (HOP_BY_HOP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

function isOperationOutcome(value: unknown): value is fhir4.OperationOutcome {
  return typeof value === "object" && value !== null && (value as { resourceType?: string }).resourceType === "OperationOutcome";
}

function validationErrorOutcome(errors: { field: string; message: string }[]): fhir4.OperationOutcome {
  return {
    resourceType: "OperationOutcome",
    issue: errors.map(error => ({
      severity: "error",
      code: "invalid",
      diagnostics: error.message,
      expression: [error.field],
    })),
  };
}

async function handleCreatePatient(req: Request): Promise<Response> {
  if (!getSessionFromRequest(req)) return unauthorizedResponse();

  let input: Partial<PatientFormInput>;
  try {
    input = (await req.json()) as Partial<PatientFormInput>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const errors = validatePatientInput(input);
  if (errors.length > 0) {
    return Response.json(validationErrorOutcome(errors), { status: 422 });
  }

  const identifierValue = input.identifier?.trim() || crypto.randomUUID();

  if (input.identifier?.trim()) {
    const existing = await searchFhirResource<fhir4.Bundle>(
      "Patient",
      `identifier=${encodeURIComponent(`https://nephra.demo/patient-id|${identifierValue}`)}`,
    );
    if (existing.status === 200 && existing.body?.total && existing.body.total > 0) {
      return Response.json(
        {
          resourceType: "OperationOutcome",
          issue: [{ severity: "error", code: "duplicate", diagnostics: "A patient with this identifier already exists." }],
        },
        { status: 409 },
      );
    }
  }

  const resource = buildPatientResource(input as PatientFormInput, identifierValue);
  const result = await createFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", resource);

  if (result.status !== 201) {
    return Response.json(result.body, { status: result.status });
  }

  const createdId = (isOperationOutcome(result.body) ? null : result.body.id) ?? extractIdFromLocation(result.location);
  return Response.json({ ...result.body, id: createdId }, { status: 201 });
}

async function handleUpdatePatient(req: Request, patientId: string): Promise<Response> {
  if (!getSessionFromRequest(req)) return unauthorizedResponse();

  let input: Partial<PatientFormInput>;
  try {
    input = (await req.json()) as Partial<PatientFormInput>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const errors = validatePatientInput(input);
  if (errors.length > 0) {
    return Response.json(validationErrorOutcome(errors), { status: 422 });
  }

  const current = await readFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", patientId);
  if (current.status !== 200 || isOperationOutcome(current.body)) {
    return Response.json(current.body, { status: current.status });
  }

  const merged = mergePatientResource(current.body, input as PatientFormInput);
  const ifMatch = req.headers.get("if-match") ?? current.etag ?? undefined;
  const result = await updateFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", patientId, merged, ifMatch);

  if (result.status === 409) {
    return Response.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "conflict",
            diagnostics: "This patient was updated by another process. Refresh and try again.",
          },
        ],
      },
      { status: 409 },
    );
  }

  return Response.json(result.body, { status: result.status });
}

async function handleDeactivatePatient(req: Request, patientId: string): Promise<Response> {
  if (!getSessionFromRequest(req)) return unauthorizedResponse();

  const current = await readFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", patientId);
  if (current.status !== 200 || isOperationOutcome(current.body)) {
    return Response.json(current.body, { status: current.status });
  }

  const deactivated: fhir4.Patient = { ...current.body, active: false };
  const result = await updateFhirResource<fhir4.Patient | fhir4.OperationOutcome>(
    "Patient",
    patientId,
    deactivated,
    current.etag ?? undefined,
  );

  return Response.json(result.body, { status: result.status });
}

const server = serve({
  routes: {
    "/fhir/*": proxyFhirRequest,

    "/api/demo-login": {
      async POST() {
        const token = createDemoSessionToken();
        return Response.json(
          {
            authenticated: true,
            user: { email: DEMO_USER.email, displayName: DEMO_USER.displayName, role: DEMO_USER.role },
          },
          { status: 200, headers: { "Set-Cookie": buildSessionCookie(token) } },
        );
      },
    },

    "/api/logout": {
      async POST() {
        return Response.json({ ok: true }, { status: 200, headers: { "Set-Cookie": buildClearedSessionCookie() } });
      },
    },

    "/api/session": {
      async GET(req) {
        const session = getSessionFromRequest(req);
        if (!session) return Response.json({ authenticated: false }, { status: 200 });
        return Response.json(
          {
            authenticated: true,
            user: { email: session.email, displayName: session.displayName, role: session.role },
          },
          { status: 200 },
        );
      },
    },

    "/api/patients": {
      POST: handleCreatePatient,
    },

    "/api/patients/:patientId": {
      PUT: req => handleUpdatePatient(req, req.params.patientId),
    },

    "/api/patients/:patientId/deactivate": {
      POST: req => handleDeactivatePatient(req, req.params.patientId),
    },

    "/api/clinician-worklist": {
      async GET(req) {
        if (!getSessionFromRequest(req)) return unauthorizedResponse();

        try {
          const worklist = await buildClinicianWorklist();
          return Response.json(worklist, { status: 200 });
        } catch (error) {
          console.error("Failed to build clinician worklist:", error instanceof Error ? error.message : "unknown error");
          return networkErrorResponse();
        }
      },
    },

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async req => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },

    // Serve index.html for all unmatched routes.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
