import { createFhirResource, readFhirResource, searchFhirResource, updateFhirResource } from "./fhir-server-client.js";
import { formatMedicationText, formatObservationName, referencesPatient } from "./formatters.js";
import { LOINC_CODES } from "./fhir-observations.js";
import type {
  AnalyzeClinicalNoteInput,
  ApproveConceptInput,
  ClinicalConceptCategory,
  ClinicalConceptSuggestion,
  ClinicalNoteAnalysisResponse,
  ClinicalNoteDraftPayload,
  ClinicalNoteDraftView,
  ConceptCertainty,
  ConceptDecisionResponse,
  ConceptPresenceStatus,
  ConceptSubject,
  ConceptTemporality,
  CreatePriorAuthTaskInput,
  PriorAuthEvidenceItem,
  PriorAuthReadiness,
  RejectConceptInput,
  SaveClinicalNoteInput,
  SdohReferralDraftInput,
  SdohReferralDraftResponse,
  SdohReferralOpportunity,
  StatementKind,
  TerminologyCandidate,
  TerminologySystem,
} from "./notes-coding-types.js";

const DOCUMENT_TYPE_SYSTEM = "https://luppedin.example/fhir/CodeSystem/document-type";
const DOCUMENT_TYPE_CODE = "clinical-note-draft";
const COMMUNITY_REFERRAL_TEXT = "Community support referral";
const COMMUNITY_REFERRAL_TASK_DESCRIPTION = "Follow up on community support referral";
const PRIOR_AUTH_TASK_DESCRIPTION = "Prepare missing prior-authorization documentation";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const MAX_NOTE_LENGTH = 12000;

const TERMINOLOGY_SYSTEM_URIS: Record<TerminologySystem, string> = {
  SNOMED_CT: "http://snomed.info/sct",
  ICD_10_CM: "http://hl7.org/fhir/sid/icd-10-cm",
  ICD_10_CM_Z: "http://hl7.org/fhir/sid/icd-10-cm",
  RXNORM: "http://www.nlm.nih.gov/research/umls/rxnorm",
  LOINC: "http://loinc.org",
};

const CATEGORY_DEFAULT_SYSTEMS: Record<ClinicalConceptCategory, TerminologySystem[]> = {
  diagnosis: ["SNOMED_CT", "ICD_10_CM"],
  symptom: ["SNOMED_CT", "ICD_10_CM"],
  clinical_finding: ["SNOMED_CT"],
  medication: ["RXNORM"],
  medication_history: ["RXNORM", "SNOMED_CT"],
  medication_intolerance: ["SNOMED_CT", "ICD_10_CM"],
  inadequate_response: ["SNOMED_CT"],
  adherence_issue: ["SNOMED_CT", "ICD_10_CM_Z"],
  refill_issue: ["SNOMED_CT", "ICD_10_CM_Z"],
  laboratory_finding: ["LOINC", "SNOMED_CT"],
  treatment_plan: ["SNOMED_CT"],
  proposed_medication: ["RXNORM"],
  social_determinant: ["ICD_10_CM_Z", "SNOMED_CT"],
  referral_need: ["SNOMED_CT"],
  follow_up_need: ["SNOMED_CT"],
};

const SOCIAL_SUPPORT_LABELS: Record<string, string> = {
  financial: "Community Health Center financial counselor, medication-assistance program, or community-resource navigator",
  affordability: "Community Health Center financial counselor, medication-assistance program, or community-resource navigator",
  copay: "Community Health Center financial counselor, medication-assistance program, or community-resource navigator",
  insurance: "Insurance navigator or Community Health Center enrollment support",
  transportation: "Transportation assistance or community-resource navigator",
  food: "Food support program or Community Health Center community-resource navigator",
  housing: "Housing support organization or community-resource navigator",
  access: "Community-resource navigator or social work follow-up",
};

interface OpenAiConcept {
  sourceText: string;
  normalizedConcept: string;
  category: ClinicalConceptCategory;
  status: ConceptPresenceStatus;
  certainty: ConceptCertainty;
  temporality: ConceptTemporality;
  subject: ConceptSubject;
  associatedMedication: string | null;
  suggestedTerminologySystems: TerminologySystem[];
  requiresClinicianReview: boolean;
  statementKind: StatementKind;
}

interface TerminologyConfig {
  baseUrl: string | null;
  bearerToken: string | null;
}

function isOperationOutcome(value: unknown): value is fhir4.OperationOutcome {
  return typeof value === "object" && value !== null && (value as { resourceType?: string }).resourceType === "OperationOutcome";
}

function terminologyConfig(): TerminologyConfig {
  return {
    baseUrl: process.env.TERMINOLOGY_FHIR_BASE_URL ?? process.env.TERMINOLOGY_BASE_URL ?? null,
    bearerToken: process.env.TERMINOLOGY_BEARER_TOKEN ?? null,
  };
}

export function isTerminologyServiceConfigured(): boolean {
  return !!terminologyConfig().baseUrl;
}

function encodePayload(payload: ClinicalNoteDraftPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decodePayload(data: string): ClinicalNoteDraftPayload | null {
  try {
    const decoded = Buffer.from(data, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as ClinicalNoteDraftPayload;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function sourceCoding(candidate: TerminologyCandidate): fhir4.Coding {
  return {
    system: candidate.systemUri,
    code: candidate.code ?? undefined,
    display: candidate.officialDisplay ?? candidate.display ?? undefined,
  };
}

function noteDocumentReference(payload: ClinicalNoteDraftPayload): fhir4.DocumentReference {
  return {
    resourceType: "DocumentReference",
    status: "current",
    docStatus: payload.status === "finalized" ? "final" : "preliminary",
    subject: { reference: `Patient/${payload.patientId}` },
    date: payload.noteDate,
    type: {
      coding: [{ system: DOCUMENT_TYPE_SYSTEM, code: DOCUMENT_TYPE_CODE, display: "Clinical note draft" }],
      text: payload.noteType,
    },
    author: [{ display: payload.author }],
    content: [
      {
        attachment: {
          contentType: "application/json",
          title: "LuppedIn clinical note coding draft",
          creation: payload.noteDate,
          data: encodePayload(payload),
        },
      },
    ],
    description: "Clinical note draft with clinician-reviewed coding suggestions.",
  };
}

function draftView(documentId: string, payload: ClinicalNoteDraftPayload): ClinicalNoteDraftView {
  return {
    ...payload,
    draftId: documentId,
    fhirReference: `DocumentReference/${documentId}`,
  };
}

async function createProvenance(
  targetReferences: string[],
  activity: string,
  actorDisplay: string,
  sourceDraftId?: string,
  detail?: string,
): Promise<string | null> {
  const provenance: fhir4.Provenance = {
    resourceType: "Provenance",
    target: targetReferences.map(reference => ({ reference })),
    recorded: nowIso(),
    activity: { text: activity },
    agent: [{ type: { text: "Clinician reviewer" }, who: { display: actorDisplay } }],
    ...(sourceDraftId
      ? {
          entity: [
            {
              role: "source",
              what: { reference: `DocumentReference/${sourceDraftId}`, display: detail },
            },
          ],
        }
      : {}),
  };
  const result = await createFhirResource<fhir4.Provenance | fhir4.OperationOutcome>("Provenance", provenance);
  if (result.status !== 201 || isOperationOutcome(result.body)) return null;
  return result.body.id ? `Provenance/${result.body.id}` : null;
}

function validateNoteInput(input: Partial<AnalyzeClinicalNoteInput>): string | null {
  if (!input.noteText || input.noteText.trim().length < 20) return "Clinical note text must contain at least 20 characters.";
  if (input.noteText.length > MAX_NOTE_LENGTH) return `Clinical note text must be ${MAX_NOTE_LENGTH} characters or fewer.`;
  if (!input.noteDate) return "Note date is required.";
  if (!input.author?.trim()) return "Author is required.";
  if (!input.noteType?.trim()) return "Note type is required.";
  return null;
}

function emptyPayload(patientId: string, input: SaveClinicalNoteInput): ClinicalNoteDraftPayload {
  return {
    version: 1,
    patientId,
    encounterId: input.encounterId,
    noteText: input.noteText,
    noteDate: input.noteDate,
    author: input.author,
    noteType: input.noteType,
    status: input.status ?? "draft",
    analysisMode: "not-run",
    concepts: [],
    createdResourceReferences: [],
    rejectedConceptIds: [],
    provenanceReferences: [],
  };
}

export async function createClinicalNoteDraft(
  patientId: string,
  input: SaveClinicalNoteInput,
  actorDisplay: string,
): Promise<{ ok: true; draft: ClinicalNoteDraftView } | { ok: false; status: number; error: string }> {
  const validationError = validateNoteInput(input);
  if (validationError) return { ok: false, status: 400, error: validationError };

  const patient = await readFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", patientId);
  if (patient.status !== 200 || isOperationOutcome(patient.body)) return { ok: false, status: patient.status, error: "Patient not found." };

  const payload = emptyPayload(patientId, { ...input, author: input.author || actorDisplay });
  const created = await createFhirResource<fhir4.DocumentReference | fhir4.OperationOutcome>("DocumentReference", noteDocumentReference(payload));
  if (created.status !== 201 || isOperationOutcome(created.body) || !created.body.id) {
    return { ok: false, status: created.status, error: "Unable to save the clinical note draft." };
  }
  const draft = draftView(created.body.id, { ...payload, draftId: created.body.id });
  const provenanceRef = await createProvenance([draft.fhirReference], "Clinical note draft saved", actorDisplay, created.body.id);
  if (provenanceRef) draft.provenanceReferences = [...draft.provenanceReferences, provenanceRef];
  await updateClinicalNoteDraft(draft.draftId, draft);
  return { ok: true, draft };
}

export async function loadClinicalNoteDraft(
  draftId: string,
): Promise<{ ok: true; document: fhir4.DocumentReference; draft: ClinicalNoteDraftView } | { ok: false; status: number; error: string }> {
  const result = await readFhirResource<fhir4.DocumentReference | fhir4.OperationOutcome>("DocumentReference", draftId);
  if (result.status !== 200 || isOperationOutcome(result.body)) return { ok: false, status: result.status, error: "Clinical note draft not found." };
  const data = result.body.content?.[0]?.attachment?.data;
  const payload = data ? decodePayload(data) : null;
  if (!payload) return { ok: false, status: 422, error: "Clinical note draft payload is invalid." };
  return { ok: true, document: result.body, draft: draftView(draftId, { ...payload, draftId }) };
}

export async function updateClinicalNoteDraft(
  draftId: string,
  payload: ClinicalNoteDraftPayload,
): Promise<{ ok: true; draft: ClinicalNoteDraftView } | { ok: false; status: number; error: string }> {
  const loaded = await loadClinicalNoteDraft(draftId);
  if (!loaded.ok) return loaded;
  const nextPayload = { ...payload, draftId };
  const updatedDoc = { ...noteDocumentReference(nextPayload), id: draftId };
  const result = await updateFhirResource<fhir4.DocumentReference | fhir4.OperationOutcome>("DocumentReference", draftId, updatedDoc);
  if (result.status < 200 || result.status >= 300 || isOperationOutcome(result.body)) {
    return { ok: false, status: result.status, error: "Unable to update the clinical note draft." };
  }
  return { ok: true, draft: draftView(draftId, nextPayload) };
}

export async function saveClinicalNoteDraft(
  draftId: string,
  input: SaveClinicalNoteInput,
  actorDisplay: string,
): Promise<{ ok: true; draft: ClinicalNoteDraftView } | { ok: false; status: number; error: string }> {
  const validationError = validateNoteInput(input);
  if (validationError) return { ok: false, status: 400, error: validationError };

  const loaded = await loadClinicalNoteDraft(draftId);
  if (!loaded.ok) return loaded;
  const payload: ClinicalNoteDraftPayload = {
    ...loaded.draft,
    noteText: input.noteText,
    noteDate: input.noteDate,
    author: input.author || actorDisplay,
    noteType: input.noteType,
    encounterId: input.encounterId,
    status: input.status ?? loaded.draft.status,
  };
  return updateClinicalNoteDraft(draftId, payload);
}

function openAiResponseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["concepts"],
    properties: {
      concepts: {
        type: "array",
        maxItems: 24,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "sourceText",
            "normalizedConcept",
            "category",
            "status",
            "certainty",
            "temporality",
            "subject",
            "associatedMedication",
            "suggestedTerminologySystems",
            "requiresClinicianReview",
            "statementKind",
          ],
          properties: {
            sourceText: { type: "string" },
            normalizedConcept: { type: "string" },
            category: {
              type: "string",
              enum: [
                "diagnosis",
                "symptom",
                "clinical_finding",
                "medication",
                "medication_history",
                "medication_intolerance",
                "inadequate_response",
                "adherence_issue",
                "refill_issue",
                "laboratory_finding",
                "treatment_plan",
                "proposed_medication",
                "social_determinant",
                "referral_need",
                "follow_up_need",
              ],
            },
            status: { type: "string", enum: ["present", "absent"] },
            certainty: { type: "string", enum: ["confirmed", "suspected"] },
            temporality: { type: "string", enum: ["current", "historical", "resolved", "planned", "unknown"] },
            subject: { type: "string", enum: ["patient", "family_member", "other", "unknown"] },
            associatedMedication: { type: ["string", "null"] },
            suggestedTerminologySystems: {
              type: "array",
              items: { type: "string", enum: ["SNOMED_CT", "ICD_10_CM", "ICD_10_CM_Z", "RXNORM", "LOINC"] },
              maxItems: 5,
            },
            requiresClinicianReview: { type: "boolean" },
            statementKind: { type: "string", enum: ["clinical", "administrative"] },
          },
        },
      },
    },
  };
}

function extractOutputText(responseBody: unknown): string | null {
  const body = responseBody as { output_text?: unknown; output?: unknown };
  if (typeof body.output_text === "string") return body.output_text;
  if (!Array.isArray(body.output)) return null;
  for (const item of body.output as { content?: unknown }[]) {
    if (!Array.isArray(item.content)) continue;
    for (const content of item.content as { text?: unknown }[]) {
      if (typeof content.text === "string") return content.text;
    }
  }
  return null;
}

function normalizeOpenAiConcepts(value: unknown): OpenAiConcept[] {
  const body = value as { concepts?: unknown };
  if (!Array.isArray(body.concepts)) throw new Error("Missing concepts array.");

  return body.concepts
    .map((concept): OpenAiConcept | null => {
      const c = concept as Partial<OpenAiConcept>;
      if (!c.sourceText || !c.normalizedConcept || !c.category || !c.status || !c.certainty || !c.temporality || !c.subject || !c.statementKind) {
        return null;
      }
      const defaultSystems = CATEGORY_DEFAULT_SYSTEMS[c.category] ?? ["SNOMED_CT"];
      return {
        sourceText: c.sourceText,
        normalizedConcept: c.normalizedConcept,
        category: c.category,
        status: c.status,
        certainty: c.certainty,
        temporality: c.temporality,
        subject: c.subject,
        associatedMedication: c.associatedMedication ?? null,
        suggestedTerminologySystems: (c.suggestedTerminologySystems?.length ? c.suggestedTerminologySystems : defaultSystems).filter(Boolean),
        requiresClinicianReview: c.requiresClinicianReview ?? true,
        statementKind: c.statementKind,
      };
    })
    .filter((concept): concept is OpenAiConcept => concept !== null);
}

async function extractConceptsWithOpenAI(
  patient: fhir4.Patient,
  conditions: fhir4.Condition[],
  input: AnalyzeClinicalNoteInput,
): Promise<OpenAiConcept[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: "system",
            content:
              "Extract candidate clinical concepts from synthetic lupus-nephritis notes. Return only structured JSON. Do not assign final diagnoses or billing codes. Preserve negation, uncertainty, temporality, subject, and whether a statement is clinical or administrative.",
          },
          {
            role: "user",
            content: JSON.stringify({
              patientContext: {
                patientId: patient.id,
                gender: patient.gender,
                birthDate: patient.birthDate,
                conditionTexts: conditions.map(condition => condition.code?.text ?? condition.code?.coding?.[0]?.display ?? condition.code?.coding?.[0]?.code).filter(Boolean),
              },
              noteText: input.noteText,
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "clinical_note_concepts",
            strict: true,
            schema: openAiResponseSchema(),
          },
        },
      }),
    });

    const body = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const error = (body as { error?: { message?: string; type?: string; code?: string } } | null)?.error;
      const safeDetail = [error?.type, error?.code, error?.message].filter(Boolean).join(": ");
      throw new Error(`OpenAI extraction failed (${response.status})${safeDetail ? `: ${safeDetail.slice(0, 240)}` : ""}`);
    }
    const outputText = extractOutputText(body);
    if (!outputText) throw new Error("OpenAI extraction returned no structured output.");
    return normalizeOpenAiConcepts(JSON.parse(outputText));
  } finally {
    clearTimeout(timeout);
  }
}

function unavailableCandidate(system: TerminologySystem): TerminologyCandidate {
  return {
    id: crypto.randomUUID(),
    system,
    systemUri: TERMINOLOGY_SYSTEM_URIS[system],
    code: null,
    display: null,
    validationStatus: "unavailable",
    officialDisplay: null,
    terminologyService: "not-configured",
    confidenceCategory: "review-required",
    message: "Terminology candidate unavailable — service configuration required",
  };
}

async function expandTerminology(system: TerminologySystem, filter: string): Promise<TerminologyCandidate[]> {
  const config = terminologyConfig();
  if (!config.baseUrl) return [unavailableCandidate(system)];

  const url = new URL(`${config.baseUrl.replace(/\/$/, "")}/ValueSet/$expand`);
  url.searchParams.set("filter", filter);
  url.searchParams.set("system", TERMINOLOGY_SYSTEM_URIS[system]);
  url.searchParams.set("count", "3");
  const headers = new Headers({ Accept: "application/fhir+json" });
  if (config.bearerToken) headers.set("Authorization", `Bearer ${config.bearerToken}`);

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      return [
        {
          ...unavailableCandidate(system),
          terminologyService: config.baseUrl,
          message: "Terminology service could not validate this concept.",
        },
      ];
    }
    const valueSet = (await response.json()) as fhir4.ValueSet;
    const contains = valueSet.expansion?.contains ?? [];
    if (contains.length === 0) {
      return [
        {
          ...unavailableCandidate(system),
          validationStatus: "no_match",
          terminologyService: config.baseUrl,
          message: "Terminology service returned no verified match.",
        },
      ];
    }
    return contains.slice(0, 3).map(match => ({
      id: crypto.randomUUID(),
      system,
      systemUri: match.system ?? TERMINOLOGY_SYSTEM_URIS[system],
      code: match.code ?? null,
      display: match.display ?? null,
      validationStatus: "validated",
      officialDisplay: match.display ?? null,
      terminologyService: config.baseUrl!,
      terminologyVersion: match.version,
      confidenceCategory: "medium",
      message: "Validated by configured terminology service.",
    }));
  } catch {
    return [
      {
        ...unavailableCandidate(system),
        terminologyService: config.baseUrl,
        message: "Terminology service could not be reached.",
      },
    ];
  }
}

async function validateTerminology(concept: OpenAiConcept): Promise<TerminologyCandidate[]> {
  const systems = concept.suggestedTerminologySystems.length > 0 ? concept.suggestedTerminologySystems : CATEGORY_DEFAULT_SYSTEMS[concept.category];
  const candidates = await Promise.all(systems.map(system => expandTerminology(system, concept.normalizedConcept)));
  return candidates.flat();
}

function clinicalCaveat(concept: OpenAiConcept): string | undefined {
  if (concept.status === "absent") return "Negated concepts are not represented as active findings.";
  if (concept.subject !== "patient") return "This statement does not refer directly to the patient and must not be coded as the patient's active condition.";
  if (concept.certainty === "suspected") return "Suspected concepts require clinician confirmation and must not be represented as confirmed.";
  if (concept.temporality === "resolved") return "Resolved history must not be represented as a current active symptom.";
  if (concept.category === "social_determinant") return "Z-code suggestion — requires clinician or coding review.";
  if (concept.category === "medication_intolerance") return "Temporal relationship alone does not prove medication causality.";
  return undefined;
}

async function buildConceptSuggestion(concept: OpenAiConcept): Promise<ClinicalConceptSuggestion> {
  return {
    id: crypto.randomUUID(),
    sourceText: concept.sourceText,
    normalizedConcept: concept.normalizedConcept,
    category: concept.category,
    status: concept.status,
    certainty: concept.certainty,
    temporality: concept.temporality,
    subject: concept.subject,
    statementKind: concept.statementKind,
    associatedMedication: concept.associatedMedication ?? undefined,
    suggestedTerminologySystems: concept.suggestedTerminologySystems,
    terminologyCandidates: await validateTerminology(concept),
    requiresClinicianReview: true,
    clinicalCaveat: clinicalCaveat(concept),
  };
}

async function loadPatientScopedResources(patientId: string) {
  const [medicationRequests, medicationStatements, medicationAdministrations, medicationDispenses, observations, documentReferences, detectedIssues, tasks] =
    await Promise.all([
      searchFhirResource<fhir4.Bundle>("MedicationRequest", `patient=${encodeURIComponent(patientId)}`),
      searchFhirResource<fhir4.Bundle>("MedicationStatement", `patient=${encodeURIComponent(patientId)}`),
      searchFhirResource<fhir4.Bundle>("MedicationAdministration", `patient=${encodeURIComponent(patientId)}`),
      searchFhirResource<fhir4.Bundle>("MedicationDispense", `patient=${encodeURIComponent(patientId)}`),
      searchFhirResource<fhir4.Bundle>("Observation", `patient=${encodeURIComponent(patientId)}`),
      searchFhirResource<fhir4.Bundle>("DocumentReference", `patient=${encodeURIComponent(patientId)}`),
      searchFhirResource<fhir4.Bundle>("DetectedIssue", `patient=${encodeURIComponent(patientId)}`),
      searchFhirResource<fhir4.Bundle>("Task", `patient=${encodeURIComponent(patientId)}`),
    ]);

  const resources = <T extends fhir4.FhirResource>(bundle: fhir4.Bundle | null | undefined, type: T["resourceType"]) =>
    (bundle?.entry ?? []).map(entry => entry.resource).filter((resource): resource is T => !!resource && resource.resourceType === type);

  return {
    medicationRequests: resources<fhir4.MedicationRequest>(medicationRequests.body, "MedicationRequest").filter(r => referencesPatient(r.subject, patientId)),
    medicationStatements: resources<fhir4.MedicationStatement>(medicationStatements.body, "MedicationStatement").filter(r => referencesPatient(r.subject, patientId)),
    medicationAdministrations: resources<fhir4.MedicationAdministration>(medicationAdministrations.body, "MedicationAdministration").filter(r => referencesPatient(r.subject, patientId)),
    medicationDispenses: resources<fhir4.MedicationDispense>(medicationDispenses.body, "MedicationDispense").filter(r => referencesPatient(r.subject, patientId)),
    observations: resources<fhir4.Observation>(observations.body, "Observation").filter(r => referencesPatient(r.subject, patientId)),
    documentReferences: resources<fhir4.DocumentReference>(documentReferences.body, "DocumentReference").filter(r => referencesPatient(r.subject, patientId)),
    detectedIssues: resources<fhir4.DetectedIssue>(detectedIssues.body, "DetectedIssue").filter(r => referencesPatient(r.patient, patientId)),
    tasks: resources<fhir4.Task>(tasks.body, "Task").filter(r => (r.for ? referencesPatient(r.for, patientId) : false)),
  };
}

function evidenceItem(
  label: string,
  status: PriorAuthEvidenceItem["status"],
  details: string,
  reference?: string,
): PriorAuthEvidenceItem {
  const [resourceType, resourceId] = reference?.split("/") ?? [];
  return {
    id: crypto.randomUUID(),
    label,
    status,
    details,
    resourceType,
    resourceId,
    reference,
  };
}

function isRenalObservation(observation: fhir4.Observation): boolean {
  const codes = observation.code.coding?.map(coding => coding.code).filter(Boolean) ?? [];
  return codes.some(code => code === LOINC_CODES.upcr || code === LOINC_CODES.egfr || code === LOINC_CODES.serumCreatinine);
}

export async function buildPriorAuthReadiness(patientId: string, draft?: ClinicalNoteDraftView): Promise<PriorAuthReadiness> {
  const resources = await loadPatientScopedResources(patientId);
  const concepts = draft?.concepts ?? [];
  const proposedTherapy =
    concepts.find(concept => concept.category === "proposed_medication" && concept.status === "present" && concept.subject === "patient")
      ?.normalizedConcept ?? null;
  const rationale =
    concepts.find(concept =>
      ["inadequate_response", "medication_intolerance", "adherence_issue", "refill_issue", "social_determinant", "treatment_plan"].includes(concept.category),
    )?.normalizedConcept ?? null;

  const evidenceFound: PriorAuthEvidenceItem[] = [];
  const missingOrUnverified: PriorAuthEvidenceItem[] = [
    evidenceItem("Payer-specific criteria", "unverified", "Payer verification pending."),
    evidenceItem("Required duration of previous therapy", "unverified", "Must be checked against payer policy."),
    evidenceItem("Prescriber attestation", "unverified", "Clinician confirmation required."),
  ];

  const previousMedication = resources.medicationRequests.find(request => request.status !== "entered-in-error");
  if (previousMedication?.id) {
    evidenceFound.push(
      evidenceItem("Previous medication order", "found", formatMedicationText(previousMedication), `MedicationRequest/${previousMedication.id}`),
    );
  } else {
    missingOrUnverified.push(evidenceItem("Previous medication order", "missing", "No MedicationRequest was found for this patient."));
  }

  const renalObservation = resources.observations.find(isRenalObservation);
  if (renalObservation?.id) {
    evidenceFound.push(
      evidenceItem("Treatment-response observations", "found", formatObservationName(renalObservation), `Observation/${renalObservation.id}`),
    );
  } else {
    missingOrUnverified.push(evidenceItem("Treatment-response observations", "missing", "No UPCR, eGFR, or creatinine observations were found."));
  }

  const signedNote = resources.documentReferences.find(doc => doc.docStatus === "final");
  if (signedNote?.id) {
    evidenceFound.push(evidenceItem("Signed clinical note", "found", signedNote.description ?? "Signed note", `DocumentReference/${signedNote.id}`));
  } else if (draft?.draftId) {
    evidenceFound.push(evidenceItem("Clinical note draft", "unverified", "Draft note is available but not finalized.", `DocumentReference/${draft.draftId}`));
  } else {
    missingOrUnverified.push(evidenceItem("Signed clinical note", "missing", "No finalized clinical note was found."));
  }

  const intoleranceConcept = concepts.find(concept => concept.category === "medication_intolerance" && concept.status === "present");
  if (intoleranceConcept) {
    evidenceFound.push(evidenceItem("Medication intolerance documentation", "unverified", intoleranceConcept.normalizedConcept, draft?.fhirReference));
  }

  const socialConcept = concepts.find(concept => concept.category === "social_determinant" && concept.status === "present");
  if (socialConcept) {
    evidenceFound.push(evidenceItem("Relevant SDOH/access documentation", "unverified", socialConcept.normalizedConcept, draft?.fhirReference));
  }

  const approvedDiagnosis = concepts.find(
    concept => concept.category === "diagnosis" && concept.clinicianDecision?.status === "approved",
  );
  const approvedClinicalConcept = concepts.find(
    concept => concept.category !== "diagnosis" && concept.clinicianDecision?.status === "approved",
  );
  const zCodeConcept = concepts.find(
    concept => concept.category === "social_determinant" && concept.terminologyCandidates.some(candidate => candidate.system === "ICD_10_CM_Z"),
  );

  const coding: PriorAuthEvidenceItem[] = [
    approvedDiagnosis
      ? evidenceItem("Approved diagnosis code", "found", approvedDiagnosis.normalizedConcept, approvedDiagnosis.clinicianDecision?.createdResourceReferences?.[0])
      : evidenceItem("Approved diagnosis code", "missing", "No diagnosis code has been approved."),
    approvedClinicalConcept
      ? evidenceItem("Approved clinical concepts", "found", approvedClinicalConcept.normalizedConcept, approvedClinicalConcept.clinicianDecision?.createdResourceReferences?.[0])
      : evidenceItem("Approved clinical concepts", "unverified", "Clinical concepts are awaiting review."),
    zCodeConcept?.clinicianDecision?.status === "approved"
      ? evidenceItem("Approved Z-code", "found", zCodeConcept.normalizedConcept, zCodeConcept.clinicianDecision.createdResourceReferences?.[0])
      : evidenceItem("Z-code awaiting coding review", zCodeConcept ? "unverified" : "missing", zCodeConcept ? zCodeConcept.normalizedConcept : "No documented Z-code candidate."),
  ];

  let readinessState: PriorAuthReadiness["readinessState"] = "Evidence gathering";
  if (!proposedTherapy || evidenceFound.length < 2) readinessState = "Missing documentation";
  else if (missingOrUnverified.some(item => item.label.includes("Payer"))) readinessState = "Payer verification needed";
  else if (coding.some(item => item.status !== "found")) readinessState = "Ready for clinician review";
  else readinessState = "Ready to prepare";

  return {
    patientId,
    draftId: draft?.draftId,
    requestedTherapy: proposedTherapy,
    authorizationRequirement: "Payer verification pending",
    readinessState,
    reasonForEscalation: rationale,
    evidenceFound,
    missingOrUnverified,
    coding,
    rationaleOptions: ["Inadequate response", "Medication intolerance", "Contraindication", "Adherence/access barrier", "Other"],
    generatedAt: nowIso(),
  };
}

export function buildSdohReferralOpportunities(draft: ClinicalNoteDraftView): SdohReferralOpportunity[] {
  return draft.concepts
    .filter(concept => ["social_determinant", "referral_need", "adherence_issue", "refill_issue"].includes(concept.category))
    .filter(concept => concept.status === "present" && concept.subject === "patient")
    .map(concept => {
      const key = Object.keys(SOCIAL_SUPPORT_LABELS).find(k => concept.normalizedConcept.toLowerCase().includes(k));
      return {
        id: crypto.randomUUID(),
        conceptId: concept.id,
        documentedBarrier: concept.normalizedConcept,
        suggestedSupport: key ? SOCIAL_SUPPORT_LABELS[key]! : "Community-resource navigator or appropriate community-based support",
        reason: "The approved social barrier may be affecting treatment access.",
        resourceVerificationStatus: "not-configured",
        approvedConceptRequired: concept.clinicianDecision?.status !== "approved",
      };
    });
}

export async function analyzeClinicalNote(
  patientId: string,
  input: AnalyzeClinicalNoteInput,
  actorDisplay: string,
): Promise<{ ok: true; response: ClinicalNoteAnalysisResponse } | { ok: false; status: number; error: string }> {
  const validationError = validateNoteInput(input);
  if (validationError) return { ok: false, status: 400, error: validationError };

  const patientResult = await readFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", patientId);
  if (patientResult.status !== 200 || isOperationOutcome(patientResult.body)) return { ok: false, status: patientResult.status, error: "Patient not found." };

  const conditionsResult = await searchFhirResource<fhir4.Bundle>("Condition", `patient=${encodeURIComponent(patientId)}`);
  const conditions = (conditionsResult.body?.entry ?? [])
    .map(entry => entry.resource)
    .filter((resource): resource is fhir4.Condition => !!resource && resource.resourceType === "Condition")
    .filter(condition => referencesPatient(condition.subject, patientId));

  let rawConcepts: OpenAiConcept[];
  try {
    rawConcepts = await extractConceptsWithOpenAI(patientResult.body, conditions, input);
  } catch (error) {
    return {
      ok: false,
      status: process.env.OPENAI_API_KEY ? 502 : 503,
      error: error instanceof Error ? error.message : "AI extraction failed. The note was not changed and no FHIR resources were created.",
    };
  }

  const concepts = await Promise.all(rawConcepts.map(buildConceptSuggestion));
  const draftResult = await createClinicalNoteDraft(
    patientId,
    { ...input, status: "analyzed", author: input.author || actorDisplay },
    actorDisplay,
  );
  if (!draftResult.ok) return draftResult;

  const nextDraft: ClinicalNoteDraftView = {
    ...draftResult.draft,
    status: "analyzed",
    model: OPENAI_MODEL,
    analysisMode: "openai",
    analysisTimestamp: nowIso(),
    concepts,
  };
  const saved = await updateClinicalNoteDraft(nextDraft.draftId, nextDraft);
  if (!saved.ok) return saved;

  const priorAuthReadiness = await buildPriorAuthReadiness(patientId, saved.draft);
  return {
    ok: true,
    response: {
      draft: saved.draft,
      concepts,
      priorAuthReadiness,
      sdohOpportunities: buildSdohReferralOpportunities(saved.draft),
      terminologyServiceConfigured: isTerminologyServiceConfigured(),
      model: OPENAI_MODEL,
    },
  };
}

function selectedCandidate(concept: ClinicalConceptSuggestion, candidateId: string | undefined): TerminologyCandidate | null {
  if (!candidateId) {
    const onlyValidated = concept.terminologyCandidates.find(candidate => candidate.validationStatus === "validated");
    return onlyValidated ?? null;
  }
  return concept.terminologyCandidates.find(candidate => candidate.id === candidateId && candidate.validationStatus === "validated") ?? null;
}

async function hasDuplicateCodedCondition(patientId: string, candidate: TerminologyCandidate): Promise<boolean> {
  if (!candidate.code) return false;
  const result = await searchFhirResource<fhir4.Bundle>(
    "Condition",
    `patient=${encodeURIComponent(patientId)}&code=${encodeURIComponent(`${candidate.systemUri}|${candidate.code}`)}`,
  );
  return (result.body?.entry ?? []).some(entry => {
    const condition = entry.resource as fhir4.Condition | undefined;
    return condition?.resourceType === "Condition" && referencesPatient(condition.subject, patientId);
  });
}

async function createResourceForConcept(
  draft: ClinicalNoteDraftView,
  concept: ClinicalConceptSuggestion,
  candidate: TerminologyCandidate,
  actorDisplay: string,
  editedConcept?: string,
): Promise<{ ok: true; references: string[] } | { ok: false; status: number; error: string }> {
  const label = editedConcept?.trim() || concept.normalizedConcept;
  const coding = sourceCoding(candidate);
  const effectiveDate = draft.noteDate || nowIso();

  if (concept.category === "diagnosis") {
    if (await hasDuplicateCodedCondition(draft.patientId, candidate)) {
      return { ok: false, status: 409, error: "A matching coded Condition already exists for this patient." };
    }
    const condition: fhir4.Condition = {
      resourceType: "Condition",
      clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active", display: "Active" }] },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            code: concept.certainty === "confirmed" ? "confirmed" : "unconfirmed",
            display: concept.certainty === "confirmed" ? "Confirmed" : "Unconfirmed",
          },
        ],
      },
      code: { coding: [coding], text: label },
      subject: { reference: `Patient/${draft.patientId}` },
      recordedDate: nowIso(),
      note: [{ text: `Approved from clinical-note phrase: ${concept.sourceText}` }],
    };
    const created = await createFhirResource<fhir4.Condition | fhir4.OperationOutcome>("Condition", condition);
    if (created.status !== 201 || isOperationOutcome(created.body) || !created.body.id) {
      return { ok: false, status: created.status, error: "Unable to create Condition." };
    }
    return { ok: true, references: [`Condition/${created.body.id}`] };
  }

  if (["medication", "medication_history", "proposed_medication"].includes(concept.category)) {
    const statement: fhir4.MedicationStatement = {
      resourceType: "MedicationStatement",
      status: concept.category === "proposed_medication" ? "intended" : concept.temporality === "current" ? "active" : "completed",
      medicationCodeableConcept: { coding: [coding], text: label },
      subject: { reference: `Patient/${draft.patientId}` },
      dateAsserted: nowIso(),
      note: [{ text: `Clinician-reviewed note concept. No medication order was created or modified. Source phrase: ${concept.sourceText}` }],
    };
    const created = await createFhirResource<fhir4.MedicationStatement | fhir4.OperationOutcome>("MedicationStatement", statement);
    if (created.status !== 201 || isOperationOutcome(created.body) || !created.body.id) {
      return { ok: false, status: created.status, error: "Unable to create MedicationStatement." };
    }
    return { ok: true, references: [`MedicationStatement/${created.body.id}`] };
  }

  const observation: fhir4.Observation = {
    resourceType: "Observation",
    status: "final",
    code: { coding: [coding], text: label },
    subject: { reference: `Patient/${draft.patientId}` },
    effectiveDateTime: effectiveDate,
    valueString: label,
    note: [{ text: `Approved from clinical-note phrase: ${concept.sourceText}` }],
    ...(concept.category === "social_determinant"
      ? { category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "social-history", display: "Social History" }] }] }
      : {}),
  };
  const created = await createFhirResource<fhir4.Observation | fhir4.OperationOutcome>("Observation", observation);
  if (created.status !== 201 || isOperationOutcome(created.body) || !created.body.id) {
    return { ok: false, status: created.status, error: "Unable to create Observation." };
  }
  return { ok: true, references: [`Observation/${created.body.id}`] };
}

export async function approveClinicalConcept(
  draftId: string,
  conceptId: string,
  input: ApproveConceptInput,
  actorDisplay: string,
): Promise<{ ok: true; response: ConceptDecisionResponse } | { ok: false; status: number; error: string }> {
  const loaded = await loadClinicalNoteDraft(draftId);
  if (!loaded.ok) return loaded;
  const concept = loaded.draft.concepts.find(item => item.id === conceptId);
  if (!concept) return { ok: false, status: 404, error: "Concept not found." };
  if (concept.status !== "present") return { ok: false, status: 422, error: "Absent or negated concepts cannot be approved as active findings." };
  if (concept.subject !== "patient") return { ok: false, status: 422, error: "Only patient-specific concepts can be approved for this record." };

  const candidate = selectedCandidate(concept, input.selectedCandidateId);
  if (!candidate) return { ok: false, status: 422, error: "A validated terminology candidate is required before FHIR write-back." };

  const created = await createResourceForConcept(loaded.draft, concept, candidate, actorDisplay, input.editedConcept);
  if (!created.ok) return created;
  const provenance = await createProvenance(created.references, "Clinical-note concept approved", actorDisplay, draftId, concept.sourceText);

  const nextConcept: ClinicalConceptSuggestion = {
    ...concept,
    normalizedConcept: input.editedConcept?.trim() || concept.normalizedConcept,
    clinicianDecision: {
      status: input.editedConcept?.trim() ? "edited" : "approved",
      decidedAt: nowIso(),
      decidedBy: actorDisplay,
      selectedCandidateId: candidate.id,
      createdResourceReferences: created.references,
      editedConcept: input.editedConcept?.trim() || undefined,
    },
  };
  const nextDraft: ClinicalNoteDraftView = {
    ...loaded.draft,
    concepts: loaded.draft.concepts.map(item => (item.id === conceptId ? nextConcept : item)),
    createdResourceReferences: [...loaded.draft.createdResourceReferences, ...created.references],
    provenanceReferences: provenance ? [...loaded.draft.provenanceReferences, provenance] : loaded.draft.provenanceReferences,
  };
  const saved = await updateClinicalNoteDraft(draftId, nextDraft);
  if (!saved.ok) return saved;
  return { ok: true, response: { draft: saved.draft, concept: nextConcept, createdResources: created.references } };
}

export async function rejectClinicalConcept(
  draftId: string,
  conceptId: string,
  input: RejectConceptInput,
  actorDisplay: string,
): Promise<{ ok: true; response: ConceptDecisionResponse } | { ok: false; status: number; error: string }> {
  const loaded = await loadClinicalNoteDraft(draftId);
  if (!loaded.ok) return loaded;
  const concept = loaded.draft.concepts.find(item => item.id === conceptId);
  if (!concept) return { ok: false, status: 404, error: "Concept not found." };
  const nextConcept: ClinicalConceptSuggestion = {
    ...concept,
    clinicianDecision: {
      status: "rejected",
      decidedAt: nowIso(),
      decidedBy: actorDisplay,
      reason: input.reason,
      createdResourceReferences: [],
    },
  };
  const nextDraft: ClinicalNoteDraftView = {
    ...loaded.draft,
    concepts: loaded.draft.concepts.map(item => (item.id === conceptId ? nextConcept : item)),
    rejectedConceptIds: Array.from(new Set([...loaded.draft.rejectedConceptIds, conceptId])),
  };
  const saved = await updateClinicalNoteDraft(draftId, nextDraft);
  if (!saved.ok) return saved;
  return { ok: true, response: { draft: saved.draft, concept: nextConcept, createdResources: [] } };
}

export async function finalizeClinicalNoteDraft(
  draftId: string,
  actorDisplay: string,
): Promise<{ ok: true; draft: ClinicalNoteDraftView } | { ok: false; status: number; error: string }> {
  const loaded = await loadClinicalNoteDraft(draftId);
  if (!loaded.ok) return loaded;
  const finalized: ClinicalNoteDraftView = { ...loaded.draft, status: "finalized" };
  const saved = await updateClinicalNoteDraft(draftId, finalized);
  if (!saved.ok) return saved;
  const provenance = await createProvenance([saved.draft.fhirReference], "Clinical note finalized", actorDisplay, draftId);
  if (!provenance) return saved;
  return updateClinicalNoteDraft(draftId, { ...saved.draft, provenanceReferences: [...saved.draft.provenanceReferences, provenance] });
}

async function duplicateServiceRequest(patientId: string, documentedBarrier: string): Promise<boolean> {
  const result = await searchFhirResource<fhir4.Bundle>("ServiceRequest", `patient=${encodeURIComponent(patientId)}`);
  return (result.body?.entry ?? []).some(entry => {
    const sr = entry.resource as fhir4.ServiceRequest | undefined;
    return (
      sr?.resourceType === "ServiceRequest" &&
      referencesPatient(sr.subject, patientId) &&
      sr.code?.text === COMMUNITY_REFERRAL_TEXT &&
      (sr.status === "draft" || sr.status === "active") &&
      (sr.reasonCode ?? []).some(reason => (reason.text ?? "").toLowerCase() === documentedBarrier.toLowerCase())
    );
  });
}

export async function createSdohReferralDraft(
  patientId: string,
  input: SdohReferralDraftInput,
  actorDisplay: string,
): Promise<{ ok: true; referral: SdohReferralDraftResponse } | { ok: false; status: number; error: string }> {
  if (!input.documentedBarrier?.trim() || !input.supportType?.trim()) {
    return { ok: false, status: 400, error: "documentedBarrier and supportType are required." };
  }
  const patient = await readFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", patientId);
  if (patient.status !== 200 || isOperationOutcome(patient.body)) return { ok: false, status: patient.status, error: "Patient not found." };
  if (await duplicateServiceRequest(patientId, input.documentedBarrier)) {
    return { ok: false, status: 409, error: "A draft or active referral already exists for this documented barrier." };
  }

  const serviceRequest: fhir4.ServiceRequest = {
    resourceType: "ServiceRequest",
    status: "draft",
    intent: "proposal",
    subject: { reference: `Patient/${patientId}` },
    code: { text: COMMUNITY_REFERRAL_TEXT },
    reasonCode: [{ text: input.documentedBarrier }],
    authoredOn: nowIso(),
    requester: { display: actorDisplay },
    performer: input.organizationName ? [{ display: input.organizationName }] : undefined,
    note: [
      { text: `Support type: ${input.supportType}` },
      { text: input.organizationName ? "Community resource verification pending." : "No directory configured; organization details require clinician verification." },
      ...(input.organizationPhone ? [{ text: `Phone: ${input.organizationPhone}` }] : []),
      ...(input.organizationAddress ? [{ text: `Address: ${input.organizationAddress}` }] : []),
      ...(input.note ? [{ text: input.note }] : []),
    ],
  };
  const created = await createFhirResource<fhir4.ServiceRequest | fhir4.OperationOutcome>("ServiceRequest", serviceRequest);
  if (created.status !== 201 || isOperationOutcome(created.body) || !created.body.id) {
    return { ok: false, status: created.status, error: "Unable to create referral draft." };
  }
  await createProvenance([`ServiceRequest/${created.body.id}`], "SDOH referral draft created", actorDisplay, undefined, input.documentedBarrier);
  return {
    ok: true,
    referral: {
      serviceRequestId: created.body.id,
      patientId,
      status: created.body.status,
      documentedBarrier: input.documentedBarrier,
      supportType: input.supportType,
      organizationDisplay: input.organizationName ?? null,
      verificationStatus: "pending",
    },
  };
}

export async function approveSdohReferralDraft(
  serviceRequestId: string,
  actorDisplay: string,
  createFollowUpTask: boolean,
): Promise<{ ok: true; referral: SdohReferralDraftResponse; taskId?: string } | { ok: false; status: number; error: string }> {
  const loaded = await readFhirResource<fhir4.ServiceRequest | fhir4.OperationOutcome>("ServiceRequest", serviceRequestId);
  if (loaded.status !== 200 || isOperationOutcome(loaded.body)) return { ok: false, status: loaded.status, error: "Referral draft not found." };
  if (loaded.body.status !== "draft") return { ok: false, status: 409, error: "Only a draft referral can be approved." };
  const updated: fhir4.ServiceRequest = {
    ...loaded.body,
    status: "active",
    intent: "order",
    requester: { display: actorDisplay },
    note: [...(loaded.body.note ?? []), { text: `Approved by ${actorDisplay}`, time: nowIso() }],
  };
  const result = await updateFhirResource<fhir4.ServiceRequest | fhir4.OperationOutcome>("ServiceRequest", serviceRequestId, updated);
  if (result.status < 200 || result.status >= 300 || isOperationOutcome(result.body)) {
    return { ok: false, status: result.status, error: "Unable to approve referral draft." };
  }

  let taskId: string | undefined;
  if (createFollowUpTask) {
    const task = await createPatientTask(
      updated.subject.reference?.split("/").pop() ?? "",
      { description: COMMUNITY_REFERRAL_TASK_DESCRIPTION, focusReference: `ServiceRequest/${serviceRequestId}` },
      actorDisplay,
    );
    if (task.ok) taskId = task.taskId;
  }

  await createProvenance([`ServiceRequest/${serviceRequestId}`], "SDOH referral approved", actorDisplay);
  return {
    ok: true,
    referral: {
      serviceRequestId,
      patientId: updated.subject.reference?.split("/").pop() ?? "",
      status: "active",
      documentedBarrier: updated.reasonCode?.[0]?.text ?? "Documented barrier",
      supportType: updated.note?.find(note => note.text?.startsWith("Support type:"))?.text?.replace("Support type:", "").trim() ?? "Community support",
      organizationDisplay: updated.performer?.[0]?.display ?? null,
      verificationStatus: "pending",
    },
    taskId,
  };
}

export async function cancelSdohReferralDraft(
  serviceRequestId: string,
  actorDisplay: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const loaded = await readFhirResource<fhir4.ServiceRequest | fhir4.OperationOutcome>("ServiceRequest", serviceRequestId);
  if (loaded.status !== 200 || isOperationOutcome(loaded.body)) return { ok: false, status: loaded.status, error: "Referral draft not found." };
  const updated: fhir4.ServiceRequest = {
    ...loaded.body,
    status: "revoked",
    note: [...(loaded.body.note ?? []), { text: `Cancelled by ${actorDisplay}`, time: nowIso() }],
  };
  const result = await updateFhirResource<fhir4.ServiceRequest | fhir4.OperationOutcome>("ServiceRequest", serviceRequestId, updated);
  if (result.status < 200 || result.status >= 300 || isOperationOutcome(result.body)) {
    return { ok: false, status: result.status, error: "Unable to cancel referral draft." };
  }
  await createProvenance([`ServiceRequest/${serviceRequestId}`], "SDOH referral draft cancelled", actorDisplay);
  return { ok: true };
}

async function duplicateTask(patientId: string, description: string, focusReference?: string): Promise<boolean> {
  const result = await searchFhirResource<fhir4.Bundle>("Task", `patient=${encodeURIComponent(patientId)}`);
  return (result.body?.entry ?? []).some(entry => {
    const task = entry.resource as fhir4.Task | undefined;
    return (
      task?.resourceType === "Task" &&
      (task.status === "requested" || task.status === "ready" || task.status === "in-progress") &&
      task.description === description &&
      (!focusReference || task.focus?.reference === focusReference)
    );
  });
}

export async function createPatientTask(
  patientId: string,
  input: CreatePriorAuthTaskInput,
  actorDisplay: string,
): Promise<{ ok: true; taskId: string } | { ok: false; status: number; error: string }> {
  const description = input.description?.trim() || PRIOR_AUTH_TASK_DESCRIPTION;
  if (await duplicateTask(patientId, description, input.focusReference)) {
    return { ok: false, status: 409, error: "A matching open Task already exists." };
  }
  const task: fhir4.Task = {
    resourceType: "Task",
    status: "requested",
    intent: "order",
    description,
    priority: "routine",
    for: { reference: `Patient/${patientId}` },
    focus: input.focusReference ? { reference: input.focusReference } : undefined,
    owner: { display: "Care coordination" },
    authoredOn: nowIso(),
    requester: { display: actorDisplay },
  };
  const created = await createFhirResource<fhir4.Task | fhir4.OperationOutcome>("Task", task);
  if (created.status !== 201 || isOperationOutcome(created.body) || !created.body.id) {
    return { ok: false, status: created.status, error: "Unable to create Task." };
  }
  await createProvenance([`Task/${created.body.id}`], "Prior-authorization or SDOH follow-up Task created", actorDisplay);
  return { ok: true, taskId: created.body.id };
}
