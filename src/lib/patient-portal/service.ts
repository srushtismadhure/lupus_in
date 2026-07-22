import { createFhirResource, readFhirResource } from "../fhir-server-client.js";
import { referencesPatient } from "../formatters.js";

export const PATIENT_PORTAL_CODE_SYSTEM = "https://luppedin.health/fhir/CodeSystem/patient-portal";
export const PATIENT_PORTAL_CODE_VERSION = "1.0.0";

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || undefined;
}

function localCode(code: string, display: string): fhir4.CodeableConcept {
  return {
    coding: [{ system: PATIENT_PORTAL_CODE_SYSTEM, code, display, version: PATIENT_PORTAL_CODE_VERSION }],
    text: display,
  };
}

type WriteResult<T> = { ok: true; resource: T } | { ok: false; status: number; error: string };

async function createPatientTask(input: {
  patientId: string;
  code: string;
  display: string;
  description: string;
  focus?: fhir4.Reference;
  note?: string;
  ownerDisplay: string;
}): Promise<WriteResult<fhir4.Task>> {
  const task: fhir4.Task = {
    resourceType: "Task",
    status: "requested",
    intent: "proposal",
    priority: "routine",
    code: localCode(input.code, input.display),
    description: input.description,
    for: { reference: `Patient/${input.patientId}` },
    focus: input.focus,
    authoredOn: new Date().toISOString(),
    requester: { reference: `Patient/${input.patientId}`, display: "Patient portal user" },
    owner: { display: input.ownerDisplay },
    note: input.note ? [{ text: input.note }] : undefined,
  };
  const created = await createFhirResource<fhir4.Task | fhir4.OperationOutcome>("Task", task);
  if (created.status !== 201 || created.body.resourceType !== "Task") {
    return { ok: false, status: created.status, error: "The care team did not receive this request. Please try again." };
  }
  return { ok: true, resource: created.body };
}

export async function createAppointmentChangeRequest(
  patientId: string,
  input: { appointmentId?: unknown; requestType?: unknown; message?: unknown },
): Promise<WriteResult<fhir4.Task>> {
  const appointmentId = cleanText(input.appointmentId, 64);
  const requestType = cleanText(input.requestType, 80);
  const message = cleanText(input.message, 1000);
  if (!appointmentId || !requestType) return { ok: false, status: 400, error: "Appointment and request type are required." };
  const loaded = await readFhirResource<fhir4.Appointment | fhir4.OperationOutcome>("Appointment", appointmentId);
  if (loaded.status !== 200 || loaded.body.resourceType !== "Appointment") return { ok: false, status: 404, error: "Appointment not found." };
  const belongs = loaded.body.participant?.some(item => referencesPatient(item.actor, patientId)) ?? false;
  if (!belongs) return { ok: false, status: 403, error: "You cannot request changes to this appointment." };
  return createPatientTask({
    patientId,
    code: "appointment-change-request",
    display: "Appointment change request",
    description: `${requestType} requested through the patient portal`,
    focus: { reference: `Appointment/${appointmentId}`, display: loaded.body.description },
    note: message,
    ownerDisplay: "Scheduling coordination team",
  });
}

export async function createRefillRequest(
  patientId: string,
  input: { medicationRequestId?: unknown; message?: unknown },
): Promise<WriteResult<fhir4.Task>> {
  const medicationRequestId = cleanText(input.medicationRequestId, 64);
  const message = cleanText(input.message, 1000);
  if (!medicationRequestId) return { ok: false, status: 400, error: "A medication is required." };
  const loaded = await readFhirResource<fhir4.MedicationRequest | fhir4.OperationOutcome>("MedicationRequest", medicationRequestId);
  if (loaded.status !== 200 || loaded.body.resourceType !== "MedicationRequest") return { ok: false, status: 404, error: "Medication request not found." };
  if (!referencesPatient(loaded.body.subject, patientId)) return { ok: false, status: 403, error: "You cannot request a refill for this medication." };
  return createPatientTask({
    patientId,
    code: "medication-refill-request",
    display: "Medication refill request",
    description: "Patient requested medication refill review",
    focus: { reference: `MedicationRequest/${medicationRequestId}`, display: loaded.body.medicationCodeableConcept?.text },
    note: message,
    ownerDisplay: "Medication review team",
  });
}

export async function createNutritionSupportRequest(
  patientId: string,
  input: { topic?: unknown; message?: unknown },
): Promise<WriteResult<fhir4.Task>> {
  const topic = cleanText(input.topic, 100) ?? "Nutrition support";
  const message = cleanText(input.message, 1000);
  return createPatientTask({
    patientId,
    code: "nutrition-support-request",
    display: "Nutrition support request",
    description: `Patient requested care-team discussion: ${topic}`,
    note: message,
    ownerDisplay: "Renal care coordination team",
  });
}

export async function createPatientPortalMessage(
  patientId: string,
  input: { category?: unknown; subject?: unknown; message?: unknown },
): Promise<WriteResult<fhir4.Communication>> {
  const category = cleanText(input.category, 80);
  const subject = cleanText(input.subject, 160);
  const message = cleanText(input.message, 4000);
  if (!category || !subject || !message) return { ok: false, status: 400, error: "Category, subject, and message are required." };
  const communication: fhir4.Communication = {
    resourceType: "Communication",
    status: "completed",
    category: [localCode("patient-message", "Patient portal message")],
    subject: { reference: `Patient/${patientId}` },
    topic: { text: subject },
    sent: new Date().toISOString(),
    sender: { reference: `Patient/${patientId}`, display: "Patient portal user" },
    recipient: [{ display: category }],
    payload: [{ contentString: message }],
    note: [{ text: "Submitted through the patient portal. Messages are not monitored for emergencies." }],
  };
  const created = await createFhirResource<fhir4.Communication | fhir4.OperationOutcome>("Communication", communication);
  if (created.status !== 201 || created.body.resourceType !== "Communication") {
    return { ok: false, status: created.status, error: "Your message was not confirmed by the medical record. Please try again." };
  }
  return { ok: true, resource: created.body };
}

