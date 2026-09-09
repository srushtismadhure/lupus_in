import type { PatientLabCategory } from "../types.js";

interface LabExplanation {
  plainLanguageName: string;
  category: PatientLabCategory;
  whatItChecks: string;
  rangeUnavailable: string;
  nextStep: string;
}

export const LAB_EXPLANATIONS: Record<string, LabExplanation> = {
  "59408-5": { plainLanguageName: "Oxygen level", category: "oxygen", whatItChecks: "This is a recent oxygen measurement documented in your record.", rangeUnavailable: "Your care team will interpret this measurement with your symptoms and care plan.", nextStep: "Follow the oxygen and breathing instructions shared by your care team." },
  "9279-1": { plainLanguageName: "Breathing rate", category: "respiratory", whatItChecks: "This records how quickly you were breathing when measured.", rangeUnavailable: "Your care team will interpret this measurement with the rest of your visit.", nextStep: "Discuss changes in breathing with your care team." },
  "19868-9": { plainLanguageName: "FEV1 percent predicted", category: "respiratory", whatItChecks: "This is a breathing test result used by clinicians to understand airflow.", rangeUnavailable: "Your care team will explain what this result means for your care plan.", nextStep: "Review breathing test results with your pulmonary care team." },
  "19926-5": { plainLanguageName: "FEV1/FVC", category: "respiratory", whatItChecks: "This is a breathing test measurement used to understand airflow.", rangeUnavailable: "Your care team will explain this result with your other breathing information.", nextStep: "Review breathing test results at your next visit." },
  "718-7": { plainLanguageName: "Hemoglobin", category: "blood-count", whatItChecks: "Hemoglobin carries oxygen in red blood cells.", rangeUnavailable: "The source did not provide a reference range.", nextStep: "Discuss persistent changes with your care team." },
  "6690-2": { plainLanguageName: "White blood cell count", category: "blood-count", whatItChecks: "White blood cells are part of the immune system.", rangeUnavailable: "The source did not provide a reference range.", nextStep: "Follow care-team instructions for this result." },
  "777-3": { plainLanguageName: "Platelet count", category: "blood-count", whatItChecks: "Platelets help blood clot.", rangeUnavailable: "The source did not provide a reference range.", nextStep: "Review unexpected changes with your care team." },
};

export const UNKNOWN_LAB_EXPLANATION: LabExplanation = {
  plainLanguageName: "Health result",
  category: "other",
  whatItChecks: "This result is part of your clinical record.",
  rangeUnavailable: "We do not have enough structured information to explain this result safely.",
  nextStep: "Ask your care team what this result means for you.",
};
