import { formatPatientName } from "../formatters.js";
import { buildDashboardSummary } from "./build-dashboard-summary.js";
import { normalizeAppointments } from "./normalize-appointments.js";
import { normalizeCarePlan } from "./normalize-care-plan.js";
import { normalizeCareTeamForPortal } from "./normalize-care-team.js";
import { normalizeDocuments } from "./normalize-documents.js";
import { normalizeLabs } from "./normalize-labs.js";
import { normalizeMedications } from "./normalize-medications.js";
import { normalizePatientMessages } from "./normalize-messages.js";
import { buildNutritionGuidance } from "./nutrition/nutrition-guidance-rules.js";
import { normalizeNutritionContext } from "./nutrition/normalize-nutrition-context.js";
import { filterMealTemplates } from "./nutrition/meal-template-filter.js";
import type { PatientPortalModel, PatientPortalRawData } from "./types.js";

function isSynthetic(patient: fhir4.Patient): boolean {
  return `${patient.text?.div ?? ""} ${patient.meta?.tag?.map(tag => tag.display ?? tag.code).join(" ") ?? ""}`.toLowerCase().includes("synthetic");
}

export function buildPatientPortalModel(raw: PatientPortalRawData, now = new Date()): PatientPortalModel {
  const displayName = formatPatientName(raw.patient);
  const firstName = raw.patient.name?.[0]?.given?.[0] ?? displayName.split(" ")[0] ?? "there";
  const labs = normalizeLabs(raw.observations);
  const medications = normalizeMedications(raw.medicationState, now);
  const appointments = normalizeAppointments(raw.appointments, now);
  const carePlan = normalizeCarePlan(raw.careCoordination);
  const careTeam = normalizeCareTeamForPortal(raw.careCoordination);
  const messages = normalizePatientMessages(raw.communications, raw.patient.id ?? "");
  const documents = normalizeDocuments(raw.documentReferences);
  const nutritionContext = normalizeNutritionContext({
    conditions: raw.conditions,
    observations: raw.observations,
    nutritionOrders: raw.nutritionOrders,
    allergies: raw.medicationState.allergies.map(allergy => allergy.text),
  });
  const nutrition = buildNutritionGuidance(nutritionContext);
  const lastUpdatedAt = [
    raw.patient.meta?.lastUpdated,
    ...raw.observations.map(item => item.meta?.lastUpdated ?? item.effectiveDateTime ?? item.issued),
    ...raw.tasks.map(item => item.meta?.lastUpdated ?? item.authoredOn),
  ]
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop() ?? now.toISOString();
  const incompleteSections: string[] = [];
  if (!labs.some(item => item.category === "respiratory" || item.category === "oxygen")) incompleteSections.push("Respiratory measurements");
  if (careTeam.length === 0) incompleteSections.push("Care team");
  if (appointments.length === 0) incompleteSections.push("Appointments");

  return {
    patient: { firstName, displayName, synthetic: isSynthetic(raw.patient) },
    dashboard: buildDashboardSummary({
      labs,
      carePlan,
      appointments,
      medications,
      messages,
      coordinator: raw.careCoordination.assignedCoordinator,
      observations: raw.observations,
      conditions: raw.conditions,
      encounters: raw.encounters,
      tasks: raw.tasks,
      serviceRequests: raw.serviceRequests,
      now,
    }),
    labs,
    nutrition,
    mealIdeas: filterMealTemplates(nutritionContext.allergies),
    carePlan,
    appointments,
    medications,
    careTeam,
    messages,
    documents,
    dataStatus: {
      lastUpdatedAt,
      incompleteSections,
      failedSections: raw.failedSections,
    },
  };
}
