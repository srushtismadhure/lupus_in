import { loadCareCoordinationData } from "../care-coordination/load-care-coordination-data.js";
import { searchFhirResource } from "../fhir-server-client.js";
import { referencesPatient } from "../formatters.js";
import { parseClinicalNoteDraftDocument } from "../notes-coding.js";
import type { SleSystemsRawData } from "./types.js";

type ExtraResource =
  | fhir4.MedicationRequest
  | fhir4.MedicationStatement
  | fhir4.Procedure
  | fhir4.DiagnosticReport
  | fhir4.DocumentReference
  | fhir4.Composition
  | fhir4.QuestionnaireResponse
  | fhir4.AdverseEvent;

type ExtraKey = Exclude<
  keyof SleSystemsRawData,
  "patient" | "conditions" | "observations" | "tasks" | "serviceRequests" | "clinicalNoteDrafts" | "failedSections"
>;

interface SearchDefinition {
  key: ExtraKey;
  resourceType: ExtraResource["resourceType"];
  queries: string[];
}

function resourcesFromBundle<T extends ExtraResource>(bundle: fhir4.Bundle, resourceType: T["resourceType"]): T[] {
  return (bundle.entry ?? [])
    .map(entry => entry.resource)
    .filter((resource): resource is T => resource?.resourceType === resourceType);
}

function belongsToPatient(resource: ExtraResource, patientId: string): boolean {
  switch (resource.resourceType) {
    case "MedicationRequest":
    case "MedicationStatement":
    case "Procedure":
    case "DiagnosticReport":
    case "DocumentReference":
    case "Composition":
    case "QuestionnaireResponse":
    case "AdverseEvent":
      return referencesPatient(resource.subject, patientId);
  }
}

async function safeSearch<T extends ExtraResource>(
  definition: SearchDefinition,
  patientId: string,
): Promise<{ resources: T[]; failed: boolean }> {
  for (const query of definition.queries) {
    const response = await searchFhirResource<fhir4.Bundle | fhir4.OperationOutcome>(definition.resourceType, query);
    if (response.status !== 200 || response.body.resourceType !== "Bundle") continue;
    return {
      resources: resourcesFromBundle<T>(response.body, definition.resourceType as T["resourceType"]).filter(resource =>
        belongsToPatient(resource, patientId),
      ),
      failed: false,
    };
  }
  return { resources: [], failed: true };
}

export async function loadSleSystemsReviewData(patientId: string): Promise<SleSystemsRawData> {
  const base = await loadCareCoordinationData(patientId);
  const encodedId = encodeURIComponent(patientId);
  const encodedReference = encodeURIComponent(`Patient/${patientId}`);
  const definitions: SearchDefinition[] = [
    { key: "medicationRequests", resourceType: "MedicationRequest", queries: [`patient=${encodedId}&_sort=-authoredon&_count=100`, `patient=${encodedId}`] },
    { key: "medicationStatements", resourceType: "MedicationStatement", queries: [`patient=${encodedId}&_count=100`, `subject=${encodedReference}`] },
    { key: "procedures", resourceType: "Procedure", queries: [`patient=${encodedId}&_sort=-date&_count=100`, `patient=${encodedId}`, `subject=${encodedReference}`] },
    { key: "diagnosticReports", resourceType: "DiagnosticReport", queries: [`patient=${encodedId}&_sort=-date&_count=100`, `patient=${encodedId}`] },
    { key: "documentReferences", resourceType: "DocumentReference", queries: [`patient=${encodedId}&_sort=-date&_count=100`, `patient=${encodedId}`, `subject=${encodedReference}`] },
    { key: "compositions", resourceType: "Composition", queries: [`subject=${encodedReference}&_sort=-date&_count=100`, `patient=${encodedId}`] },
    { key: "questionnaireResponses", resourceType: "QuestionnaireResponse", queries: [`subject=${encodedReference}&_sort=-authored&_count=100`, `patient=${encodedId}`, `subject=${encodedReference}`] },
    { key: "adverseEvents", resourceType: "AdverseEvent", queries: [`subject=${encodedReference}&_sort=-date&_count=100`, `patient=${encodedId}`, `subject=${encodedReference}`] },
  ];

  const results = await Promise.all(definitions.map(definition => safeSearch(definition, patientId)));
  const failedSections = [...base.failedSections];
  const extra: Record<ExtraKey, ExtraResource[]> = {
    medicationRequests: [],
    medicationStatements: [],
    procedures: [],
    diagnosticReports: [],
    documentReferences: [],
    compositions: [],
    questionnaireResponses: [],
    adverseEvents: [],
  };

  definitions.forEach((definition, index) => {
    const result = results[index];
    if (!result) return;
    if (result.failed) failedSections.push(definition.resourceType);
    extra[definition.key] = result.resources;
  });

  const documentReferences = extra.documentReferences as fhir4.DocumentReference[];
  const clinicalNoteDrafts = documentReferences.flatMap(document => {
    const draft = parseClinicalNoteDraftDocument(document);
    return draft?.patientId === patientId ? [draft] : [];
  });

  return {
    patient: base.patient,
    conditions: base.conditions,
    observations: base.observations,
    medicationRequests: extra.medicationRequests as fhir4.MedicationRequest[],
    medicationStatements: extra.medicationStatements as fhir4.MedicationStatement[],
    procedures: extra.procedures as fhir4.Procedure[],
    diagnosticReports: extra.diagnosticReports as fhir4.DiagnosticReport[],
    documentReferences,
    compositions: extra.compositions as fhir4.Composition[],
    questionnaireResponses: extra.questionnaireResponses as fhir4.QuestionnaireResponse[],
    tasks: base.tasks,
    serviceRequests: base.serviceRequests,
    adverseEvents: extra.adverseEvents as fhir4.AdverseEvent[],
    clinicalNoteDrafts,
    failedSections: [...new Set(failedSections)],
  };
}
