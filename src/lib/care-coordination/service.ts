import {
  createFhirResource,
  executeFhirTransaction,
  readFhirResource,
  updateFhirResource,
  type FhirServerResponse,
} from "../fhir-server-client.js";
import { referencesPatient } from "../formatters.js";
import { CARE_COORDINATION_SYSTEMS, CARE_COORDINATION_TERMINOLOGY_VERSION } from "../terminology/care-coordination-codes.js";
import { buildCareCoordinationTransaction } from "./fhir/build-transaction-bundle.js";
import { loadCareCoordinationData } from "./load-care-coordination-data.js";
import { buildCareCoordinationPlan } from "./normalize.js";
import type {
  CareCoordinationReferralPreview,
  CarePathwayType,
  ReferralDestination,
  ReferralReviewInput,
} from "./types.js";

const WRITABLE_PATHWAY_TYPES = [
  "medical-nutrition-therapy",
  "kidney-transplant-evaluation",
  "dialysis-planning",
  "renal-nurse-follow-up",
] as const;

export type WritableCarePathwayType = (typeof WRITABLE_PATHWAY_TYPES)[number];

export interface ReferralActionBody {
  pathwayType?: string;
  coordinatorReference?: string;
  coordinatorDisplay?: string;
  destinationReference?: string;
  destinationDisplay?: string;
  dueDate?: string;
}

export type ReferralActionResult =
  | { ok: true; preview: CareCoordinationReferralPreview; responseBundle?: fhir4.Bundle }
  | { ok: false; status: number; error: string };

function isWritablePathwayType(value: string | undefined): value is WritableCarePathwayType {
  return WRITABLE_PATHWAY_TYPES.includes(value as WritableCarePathwayType);
}

function validReference(reference: string | undefined, allowedTypes: string[]): string | undefined {
  if (!reference) return undefined;
  const match = reference.match(/^([A-Za-z]+)\/([A-Za-z0-9\-.]{1,64})$/);
  if (!match?.[1] || !allowedTypes.includes(match[1])) return undefined;
  return reference;
}

function cleanDisplay(value: string | undefined, fallback?: string): string | undefined {
  const trimmed = value?.trim().slice(0, 160);
  return trimmed || fallback;
}

function validDueDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function responseSucceeded(response: FhirServerResponse<fhir4.Bundle | fhir4.OperationOutcome>): response is FhirServerResponse<fhir4.Bundle> {
  if (response.status < 200 || response.status >= 300 || response.body.resourceType !== "Bundle") return false;
  return (response.body.entry ?? []).every(entry => {
    const status = entry.response?.status;
    return !status || /^20\d/.test(status);
  });
}

async function reviewInput(
  patientId: string,
  actorDisplay: string,
  body: ReferralActionBody,
  approved: boolean,
): Promise<{ ok: true; input: ReferralReviewInput } | { ok: false; status: number; error: string }> {
  if (!isWritablePathwayType(body.pathwayType)) return { ok: false, status: 400, error: "A supported pathwayType is required." };
  const raw = await loadCareCoordinationData(patientId);
  const plan = buildCareCoordinationPlan(raw);
  const pathway = plan.pathways.find(item => item.pathwayType === body.pathwayType && item.requiresClinicianApproval);
  if (!pathway) return { ok: false, status: 409, error: "This pathway no longer has a referral proposal awaiting review." };
  if (!pathway.sourceRuleId || !pathway.ruleVersion) {
    return { ok: false, status: 409, error: "Existing draft referrals must be reviewed through their originating workflow." };
  }

  const coordinatorReference = validReference(body.coordinatorReference, ["Practitioner", "PractitionerRole", "CareTeam", "Organization"]);
  if (body.coordinatorReference && !coordinatorReference) return { ok: false, status: 400, error: "The coordinator reference is invalid." };
  const destinationReference = validReference(body.destinationReference, ["Organization", "HealthcareService"]);
  if (body.destinationReference && !destinationReference) return { ok: false, status: 400, error: "The destination reference is invalid." };
  const dueDate = validDueDate(body.dueDate);
  if (body.dueDate && !dueDate) return { ok: false, status: 400, error: "The due date is invalid." };

  const destinationDisplay = cleanDisplay(body.destinationDisplay);
  const destination: ReferralDestination | undefined = destinationDisplay
    ? { reference: destinationReference, display: destinationDisplay }
    : body.pathwayType === "medical-nutrition-therapy"
      ? { display: "Unassigned renal dietitian service" }
      : undefined;

  const input: ReferralReviewInput = {
    patientId,
    pathwayType: body.pathwayType,
    reason: pathway.reason,
    evidence: pathway.evidence,
    reasonReferences: pathway.evidence
      .filter(item => item.resourceReference?.startsWith("Condition/"))
      .map(item => ({ reference: item.resourceReference, display: item.label })),
    supportingInfo: pathway.evidence
      .filter(item => item.resourceReference?.startsWith("Observation/"))
      .map(item => ({ reference: item.resourceReference, display: item.value ? `${item.label}: ${item.value}` : item.label })),
    clinician: { display: cleanDisplay(actorDisplay, "Authorized clinician") },
    coordinator: coordinatorReference || body.coordinatorDisplay
      ? { reference: coordinatorReference, display: cleanDisplay(body.coordinatorDisplay, "Assigned coordinator") }
      : undefined,
    destination,
    dueDate,
    approved,
    authoredOn: new Date().toISOString(),
    sourceRuleId: pathway.sourceRuleId,
    ruleVersion: pathway.ruleVersion,
    existingCarePlan: raw.carePlans.find(item => item.status === "active") ?? raw.carePlans[0],
    existingCareTeam: raw.careTeams.find(item => item.status === "active") ?? raw.careTeams[0],
  };
  return { ok: true, input };
}

export async function previewCareCoordinationReferral(
  patientId: string,
  actorDisplay: string,
  body: ReferralActionBody,
): Promise<ReferralActionResult> {
  try {
    const prepared = await reviewInput(patientId, actorDisplay, body, false);
    if (!prepared.ok) return prepared;
    return { ok: true, preview: buildCareCoordinationTransaction(prepared.input) };
  } catch {
    return { ok: false, status: 502, error: "Care-coordination data could not be retrieved." };
  }
}

export async function confirmCareCoordinationReferral(
  patientId: string,
  actorDisplay: string,
  body: ReferralActionBody,
  execute: typeof executeFhirTransaction = executeFhirTransaction,
): Promise<ReferralActionResult> {
  try {
    const prepared = await reviewInput(patientId, actorDisplay, body, true);
    if (!prepared.ok) return prepared;
    const preview = buildCareCoordinationTransaction(prepared.input);
    const response = await execute<fhir4.Bundle | fhir4.OperationOutcome>(preview.transaction);
    if (!responseSucceeded(response)) {
      return { ok: false, status: response.status >= 400 ? response.status : 502, error: "The FHIR server did not confirm the referral transaction." };
    }
    return { ok: true, preview, responseBundle: response.body };
  } catch {
    return { ok: false, status: 502, error: "The referral could not be submitted to the FHIR server." };
  }
}

export interface TaskActionBody {
  action?: "assign" | "reassign" | "start" | "block" | "complete" | "cancel";
  ownerReference?: string;
  ownerDisplay?: string;
  reason?: string;
  completionNote?: string;
  completionReference?: string;
  confirmed?: boolean;
}

export async function updateCoordinationTask(
  patientId: string,
  taskId: string,
  actorDisplay: string,
  body: TaskActionBody,
): Promise<{ ok: true; task: fhir4.Task } | { ok: false; status: number; error: string }> {
  if (!body.action) return { ok: false, status: 400, error: "A task action is required." };
  const loaded = await readFhirResource<fhir4.Task | fhir4.OperationOutcome>("Task", taskId);
  if (loaded.status !== 200 || loaded.body.resourceType !== "Task") return { ok: false, status: 404, error: "Task not found." };
  if (!referencesPatient(loaded.body.for, patientId)) return { ok: false, status: 409, error: "Task does not belong to this patient." };
  const task: fhir4.Task = { ...loaded.body, note: [...(loaded.body.note ?? [])] };
  const note = (text: string) => task.note!.push({ text, time: new Date().toISOString(), authorString: actorDisplay });

  if (body.action === "assign" || body.action === "reassign") {
    const ownerReference = validReference(body.ownerReference, ["Practitioner", "PractitionerRole", "CareTeam", "Organization"]);
    const ownerDisplay = cleanDisplay(body.ownerDisplay);
    if (!ownerReference && !ownerDisplay) return { ok: false, status: 400, error: "An owner is required." };
    task.owner = { reference: ownerReference, display: ownerDisplay };
    note(`${body.action === "assign" ? "Assigned" : "Reassigned"} by ${actorDisplay}.`);
  } else if (body.action === "start") {
    task.status = "in-progress";
    task.executionPeriod = { ...(task.executionPeriod ?? {}), start: task.executionPeriod?.start ?? new Date().toISOString() };
    note(`Started by ${actorDisplay}.`);
  } else if (body.action === "block") {
    if (!cleanDisplay(body.reason)) return { ok: false, status: 400, error: "A blocking reason is required." };
    task.status = "on-hold";
    task.businessStatus = { text: `Blocked: ${cleanDisplay(body.reason)}` };
    note(`Marked blocked by ${actorDisplay}: ${cleanDisplay(body.reason)}`);
  } else if (body.action === "complete") {
    if (body.confirmed !== true) return { ok: false, status: 400, error: "Task completion must be explicitly confirmed." };
    task.status = "completed";
    task.executionPeriod = { ...(task.executionPeriod ?? {}), end: new Date().toISOString() };
    if (cleanDisplay(body.completionNote)) note(`Completed by ${actorDisplay}: ${cleanDisplay(body.completionNote)}`);
    const completionReference = validReference(body.completionReference, ["Appointment", "Encounter", "Communication", "DocumentReference", "Observation"]);
    if (completionReference) {
      task.output = [...(task.output ?? []), { type: { text: "Completion evidence" }, valueReference: { reference: completionReference } }];
    }
  } else if (body.action === "cancel") {
    if (body.confirmed !== true) return { ok: false, status: 400, error: "Task cancellation must be explicitly confirmed." };
    task.status = "cancelled";
    note(`Cancelled by ${actorDisplay}${cleanDisplay(body.reason) ? `: ${cleanDisplay(body.reason)}` : "."}`);
  }

  const updated = await updateFhirResource<fhir4.Task | fhir4.OperationOutcome>("Task", taskId, task, loaded.etag ?? undefined);
  if (updated.status < 200 || updated.status >= 300 || updated.body.resourceType !== "Task") {
    return { ok: false, status: updated.status, error: "The FHIR server did not confirm the Task update." };
  }
  return { ok: true, task: updated.body };
}

export async function createCoordinationCommunication(
  patientId: string,
  actorDisplay: string,
  input: { recipientReference?: string; recipientDisplay?: string; subject?: string; message?: string },
): Promise<{ ok: true; communication: fhir4.Communication } | { ok: false; status: number; error: string }> {
  const subject = cleanDisplay(input.subject);
  const message = input.message?.trim().slice(0, 4000);
  if (!subject || !message) return { ok: false, status: 400, error: "Subject and message are required." };
  const recipientReference = validReference(input.recipientReference, ["Practitioner", "PractitionerRole", "CareTeam", "Organization"]);
  const communication: fhir4.Communication = {
    resourceType: "Communication",
    status: "completed",
    category: [
      {
        coding: [
          {
            system: CARE_COORDINATION_SYSTEMS.pathway,
            code: "care-coordination-communication",
            display: "Care coordination communication",
            version: CARE_COORDINATION_TERMINOLOGY_VERSION,
          },
        ],
      },
    ],
    subject: { reference: `Patient/${patientId}` },
    topic: { text: subject },
    sent: new Date().toISOString(),
    sender: { display: actorDisplay },
    recipient: [
      recipientReference || input.recipientDisplay
        ? { reference: recipientReference, display: cleanDisplay(input.recipientDisplay, "Care coordination team") }
        : { display: "Care coordination team" },
    ],
    payload: [{ contentString: message }],
  };
  const created = await createFhirResource<fhir4.Communication | fhir4.OperationOutcome>("Communication", communication);
  if (created.status !== 201 || created.body.resourceType !== "Communication") {
    return { ok: false, status: created.status, error: "The FHIR server did not confirm the communication." };
  }
  return { ok: true, communication: created.body };
}

