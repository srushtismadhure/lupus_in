import { createFhirResource, readFhirResource, updateFhirResource } from "../fhir-server-client.js";
import { createPatientTask } from "../notes-coding.js";
import {
  SLE_SYSTEMS_REVIEW_CODE_SYSTEM,
  SLE_SYSTEMS_REVIEW_LOCAL_CODES,
  SLE_SYSTEMS_REVIEW_QUESTIONNAIRE_ID,
  SLE_SYSTEMS_REVIEW_QUESTIONNAIRE_URL,
  SLE_SYSTEMS_REVIEW_VERSION,
} from "../terminology/sle-systems-review-codes.js";
import { isSleSystemId, SLE_SYSTEM_BY_ID, SLE_SYSTEM_DEFINITIONS } from "./system-definitions.js";
import type { SubmitSleAssessmentInput } from "./types.js";

function isOperationOutcome(resource: unknown): resource is fhir4.OperationOutcome {
  return typeof resource === "object" && resource !== null && (resource as { resourceType?: string }).resourceType === "OperationOutcome";
}

export function buildSleSystemsQuestionnaire(): fhir4.Questionnaire {
  return {
    resourceType: "Questionnaire",
    id: SLE_SYSTEMS_REVIEW_QUESTIONNAIRE_ID,
    url: SLE_SYSTEMS_REVIEW_QUESTIONNAIRE_URL,
    version: SLE_SYSTEMS_REVIEW_VERSION,
    name: "StructuredSleSystemsReview",
    title: "Structured SLE Systems Review",
    status: "active",
    experimental: true,
    subjectType: ["Patient"],
    code: [{ system: SLE_SYSTEMS_REVIEW_CODE_SYSTEM, code: SLE_SYSTEMS_REVIEW_LOCAL_CODES.questionnaire, display: "Structured SLE Systems Review" }],
    item: SLE_SYSTEM_DEFINITIONS.map(system => ({
      linkId: system.id,
      text: system.title,
      type: "group",
      required: false,
      item: system.checklist.map(item => ({
        linkId: `${system.id}.${item.id}`,
        text: item.label,
        type: "boolean",
        required: false,
      })),
    })),
  };
}

async function ensureQuestionnaire(): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await readFhirResource<fhir4.Questionnaire | fhir4.OperationOutcome>("Questionnaire", SLE_SYSTEMS_REVIEW_QUESTIONNAIRE_ID);
  if (existing.status === 200 && existing.body.resourceType === "Questionnaire") return { ok: true };
  const written = await updateFhirResource<fhir4.Questionnaire | fhir4.OperationOutcome>(
    "Questionnaire",
    SLE_SYSTEMS_REVIEW_QUESTIONNAIRE_ID,
    buildSleSystemsQuestionnaire(),
  );
  if (![200, 201].includes(written.status) || isOperationOutcome(written.body)) {
    return { ok: false, status: written.status || 502, error: "The SLE systems review questionnaire could not be stored." };
  }
  return { ok: true };
}

export async function submitSleSystemAssessment(
  patientId: string,
  input: SubmitSleAssessmentInput,
  actorDisplay: string,
): Promise<{ ok: true; response: fhir4.QuestionnaireResponse } | { ok: false; status: number; error: string }> {
  if (!isSleSystemId(input.systemId)) return { ok: false, status: 400, error: "A valid SLE system is required." };
  const definition = SLE_SYSTEM_BY_ID[input.systemId];
  const allowedItems = new Set(definition.checklist.map(item => item.id));
  const reviewedItemIds = [...new Set(input.reviewedItemIds ?? [])].filter(item => allowedItems.has(item));
  if (reviewedItemIds.length === 0) return { ok: false, status: 400, error: "Select at least one assessment item to mark as reviewed." };
  if (typeof input.note === "string" && input.note.length > 2000) return { ok: false, status: 400, error: "Assessment note must be 2,000 characters or fewer." };

  const patient = await readFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", patientId);
  if (patient.status !== 200 || patient.body.resourceType !== "Patient") return { ok: false, status: 404, error: "Patient not found." };
  const questionnaire = await ensureQuestionnaire();
  if (!questionnaire.ok) return questionnaire;

  const response: fhir4.QuestionnaireResponse = {
    resourceType: "QuestionnaireResponse",
    questionnaire: `${SLE_SYSTEMS_REVIEW_QUESTIONNAIRE_URL}|${SLE_SYSTEMS_REVIEW_VERSION}`,
    status: "completed",
    subject: { reference: `Patient/${patientId}` },
    authored: new Date().toISOString(),
    author: { display: actorDisplay },
    item: [
      ...reviewedItemIds.map(itemId => ({
        linkId: `${input.systemId}.${itemId}`,
        text: definition.checklist.find(item => item.id === itemId)?.label,
        answer: [{ valueBoolean: true }],
      })),
      ...(input.note?.trim()
        ? [{ linkId: `${input.systemId}.clinician-note`, text: `${definition.title} clinician review note`, answer: [{ valueString: input.note.trim() }] }]
        : []),
    ],
  };
  const created = await createFhirResource<fhir4.QuestionnaireResponse | fhir4.OperationOutcome>("QuestionnaireResponse", response);
  if (created.status !== 201 || isOperationOutcome(created.body)) {
    return { ok: false, status: created.status || 502, error: "The structured assessment could not be saved." };
  }
  return { ok: true, response: created.body };
}

export async function createSleSystemReviewTask(
  patientId: string,
  systemId: unknown,
  requestedDescription: unknown,
  actorDisplay: string,
): Promise<{ ok: true; taskId: string } | { ok: false; status: number; error: string }> {
  if (!isSleSystemId(systemId)) return { ok: false, status: 400, error: "A valid SLE system is required." };
  const description = typeof requestedDescription === "string" && requestedDescription.trim()
    ? requestedDescription.trim()
    : `Complete ${SLE_SYSTEM_BY_ID[systemId].title} SLE systems review`;
  if (description.length > 500) return { ok: false, status: 400, error: "Task description must be 500 characters or fewer." };
  return createPatientTask(patientId, { description: `SLE Systems Review - ${description}` }, actorDisplay);
}

