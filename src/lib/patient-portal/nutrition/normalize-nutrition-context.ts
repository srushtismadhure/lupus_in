import { LOINC_CODES } from "../../fhir-observations.js";
import { isRenalDiagnosisCondition } from "../../formatters.js";

export interface NutritionContext {
  renalDiseaseDocumented: boolean;
  latestPotassium?: fhir4.Observation;
  latestPhosphorus?: fhir4.Observation;
  latestAlbumin?: fhir4.Observation;
  nutritionOrders: fhir4.NutritionOrder[];
  allergies: string[];
}

function latestByCode(observations: fhir4.Observation[], code: string): fhir4.Observation | undefined {
  return observations
    .filter(observation => observation.code.coding?.some(coding => coding.code === code))
    .sort((a, b) => {
      const dateA = a.effectiveDateTime ?? a.issued ?? "";
      const dateB = b.effectiveDateTime ?? b.issued ?? "";
      return dateB.localeCompare(dateA);
    })[0];
}

export function normalizeNutritionContext(input: {
  conditions: fhir4.Condition[];
  observations: fhir4.Observation[];
  nutritionOrders: fhir4.NutritionOrder[];
  allergies: string[];
}): NutritionContext {
  return {
    renalDiseaseDocumented: input.conditions.some(isRenalDiagnosisCondition),
    latestPotassium: latestByCode(input.observations, "2823-3"),
    latestPhosphorus: latestByCode(input.observations, "2777-1"),
    latestAlbumin: latestByCode(input.observations, LOINC_CODES.serumAlbumin),
    nutritionOrders: input.nutritionOrders.filter(order => order.status === "active"),
    allergies: input.allergies,
  };
}

