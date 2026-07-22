import { searchFhirResource } from "../fhir-server-client.js";
import { loadCareCoordinationData } from "../care-coordination/load-care-coordination-data.js";
import { buildCareCoordinationPlan } from "../care-coordination/normalize.js";
import { getPatientMedicationState } from "../medications.js";
import type { MedicationPatientState } from "../medication-types.js";
import type { PatientPortalRawData } from "./types.js";

function bundleResources<T extends fhir4.Resource>(body: fhir4.Bundle | fhir4.OperationOutcome, resourceType: T["resourceType"]): T[] {
  if (body.resourceType !== "Bundle") return [];
  return (body.entry ?? []).map(entry => entry.resource).filter((resource): resource is T => resource?.resourceType === resourceType);
}

async function safeSearch<T extends fhir4.Resource>(
  resourceType: T["resourceType"],
  patientId: string,
  suffix = "",
): Promise<{ resources: T[]; failed: boolean }> {
  const base = `patient=${encodeURIComponent(patientId)}`;
  let result = await searchFhirResource<fhir4.Bundle | fhir4.OperationOutcome>(resourceType, `${base}${suffix}`);
  if (result.status >= 400 && suffix) result = await searchFhirResource<fhir4.Bundle | fhir4.OperationOutcome>(resourceType, base);
  return result.status === 200 && result.body.resourceType === "Bundle"
    ? { resources: bundleResources<T>(result.body, resourceType), failed: false }
    : { resources: [], failed: true };
}

function emptyMedicationState(patientId: string): MedicationPatientState {
  return {
    patientId,
    cohortMember: false,
    safetyCounts: { conflicts: 0, monitoringGaps: 0, reconciliationIssues: 0, symptomsRequiringReview: 0, openTasks: 0 },
    regimenByGroup: {
      "lupus-nephritis-treatment": [],
      "kidney-cardiovascular-support": [],
      "preventive-supportive-care": [],
      other: [],
    },
    inactiveOrders: [],
    reconciliationIssues: [],
    detectedIssues: [],
    medicationStatements: [],
    medicationAdministrations: [],
    allergies: [],
    assessments: [],
    generatedAt: new Date().toISOString(),
  };
}

export async function loadPatientPortalData(patientId: string): Promise<PatientPortalRawData> {
  const careRaw = await loadCareCoordinationData(patientId);
  const careCoordination = buildCareCoordinationPlan(careRaw);
  const [diagnosticReports, documentReferences, nutritionOrders, medicationStateResult] = await Promise.all([
    safeSearch<fhir4.DiagnosticReport>("DiagnosticReport", patientId, "&_sort=-date&_count=100"),
    safeSearch<fhir4.DocumentReference>("DocumentReference", patientId, "&_sort=-date&_count=100"),
    safeSearch<fhir4.NutritionOrder>("NutritionOrder", patientId, "&_sort=-date&_count=50"),
    getPatientMedicationState(careRaw.patient, careRaw.conditions)
      .then(state => ({ state, failed: false }))
      .catch(() => ({ state: emptyMedicationState(patientId), failed: true })),
  ]);

  const failedSections = [...careRaw.failedSections];
  if (diagnosticReports.failed) failedSections.push("DiagnosticReport");
  if (documentReferences.failed) failedSections.push("DocumentReference");
  if (nutritionOrders.failed) failedSections.push("NutritionOrder");
  if (medicationStateResult.failed) failedSections.push("Medication data");

  return {
    patient: careRaw.patient,
    conditions: careRaw.conditions,
    observations: careRaw.observations,
    diagnosticReports: diagnosticReports.resources,
    medicationState: medicationStateResult.state,
    careCoordination,
    serviceRequests: careRaw.serviceRequests,
    tasks: careRaw.tasks,
    carePlans: careRaw.carePlans,
    goals: careRaw.goals,
    appointments: careRaw.appointments,
    encounters: careRaw.encounters,
    careTeams: careRaw.careTeams,
    communications: careRaw.communications,
    documentReferences: documentReferences.resources,
    nutritionOrders: nutritionOrders.resources,
    failedSections: [...new Set(failedSections)],
  };
}

