import type { PatientLabCategory } from "../types.js";

interface LabExplanation {
  plainLanguageName: string;
  category: PatientLabCategory;
  whatItChecks: string;
  rangeUnavailable: string;
  nextStep: string;
}

export const LAB_EXPLANATIONS: Record<string, LabExplanation> = {
  "98979-8": {
    plainLanguageName: "Estimated kidney filtering rate",
    category: "kidney-function",
    whatItChecks: "This estimates how well your kidneys filter waste from your blood.",
    rangeUnavailable: "Your result is shown without a laboratory reference range. Your care team will interpret it with your history.",
    nextStep: "Review the trend with your kidney care team and complete follow-up testing when ordered.",
  },
  "2160-0": {
    plainLanguageName: "Creatinine",
    category: "kidney-function",
    whatItChecks: "Creatinine is a waste product used to help assess kidney function.",
    rangeUnavailable: "A reference range was not supplied with this result, so the portal does not label it within or outside range.",
    nextStep: "Keep the follow-up plan listed by your care team. Ask about changes that are not explained in your plan.",
  },
  "2890-2": {
    plainLanguageName: "Urine protein-to-creatinine ratio",
    category: "urine-protein",
    whatItChecks: "This compares protein and creatinine in urine to help track protein leakage from the kidneys.",
    rangeUnavailable: "Your care team interprets this result using your kidney diagnosis and trend, not one number alone.",
    nextStep: "Complete repeat urine testing when ordered and discuss your care-team target at your next visit.",
  },
  "4485-9": {
    plainLanguageName: "Complement C3",
    category: "lupus-activity",
    whatItChecks: "C3 is part of the immune system. Your care team may follow its pattern as part of lupus monitoring.",
    rangeUnavailable: "No source range was supplied. This result cannot be labeled within range from the available record.",
    nextStep: "Review this result together with C4, anti-double-stranded DNA, symptoms, and your clinical assessment.",
  },
  "4498-2": {
    plainLanguageName: "Complement C4",
    category: "lupus-activity",
    whatItChecks: "C4 is part of the immune system and may be followed as one part of lupus monitoring.",
    rangeUnavailable: "No source range was supplied. The trend is shown without declaring the result normal.",
    nextStep: "Ask your care team how this result fits with your other lupus monitoring information.",
  },
  "5130-0": {
    plainLanguageName: "Anti-double-stranded DNA antibody",
    category: "lupus-activity",
    whatItChecks: "This antibody test can help your care team monitor lupus when interpreted with other findings.",
    rangeUnavailable: "A laboratory reference range was not included with this record.",
    nextStep: "Do not change treatment based on this test alone. Review the result with your care team.",
  },
  "1751-7": {
    plainLanguageName: "Albumin",
    category: "electrolyte",
    whatItChecks: "Albumin is a blood protein. Kidney protein loss, nutrition, inflammation, and other factors can affect it.",
    rangeUnavailable: "The available result does not include a source reference range.",
    nextStep: "Ask your care team whether this result changes your monitoring or nutrition plan.",
  },
  "3094-0": {
    plainLanguageName: "Blood urea nitrogen",
    category: "kidney-function",
    whatItChecks: "This measures a waste product in blood and is interpreted with creatinine, hydration, and other information.",
    rangeUnavailable: "The source did not provide a reference range.",
    nextStep: "Review this result with your other kidney tests.",
  },
  "2823-3": {
    plainLanguageName: "Potassium",
    category: "electrolyte",
    whatItChecks: "Potassium supports nerves, muscles, and heart rhythm. Kidney function and medicines can affect it.",
    rangeUnavailable: "Without a source range, the portal does not recommend a potassium restriction.",
    nextStep: "Do not change your diet or medicines based on this result without speaking with your care team.",
  },
  "2777-1": {
    plainLanguageName: "Phosphorus",
    category: "electrolyte",
    whatItChecks: "Phosphorus is a mineral that may be monitored in kidney disease.",
    rangeUnavailable: "Without a source range and care-team plan, the portal does not recommend a phosphorus restriction.",
    nextStep: "Ask your care team or dietitian before making a major phosphorus-related diet change.",
  },
  "2951-2": {
    plainLanguageName: "Sodium",
    category: "electrolyte",
    whatItChecks: "This measures sodium in the blood. It is not the same as measuring how much salt you eat.",
    rangeUnavailable: "The source did not provide a reference range.",
    nextStep: "Follow only the sodium guidance documented by your care team.",
  },
  "17861-6": {
    plainLanguageName: "Calcium",
    category: "electrolyte",
    whatItChecks: "Calcium supports bones, nerves, and muscles and is interpreted with other laboratory results.",
    rangeUnavailable: "The source did not provide a reference range.",
    nextStep: "Do not start a calcium supplement unless your care team recommends it.",
  },
  "718-7": {
    plainLanguageName: "Hemoglobin",
    category: "blood-count",
    whatItChecks: "Hemoglobin carries oxygen in red blood cells.",
    rangeUnavailable: "The source did not provide a reference range.",
    nextStep: "Discuss persistent changes with your care team.",
  },
  "6690-2": {
    plainLanguageName: "White blood cell count",
    category: "blood-count",
    whatItChecks: "White blood cells are part of the immune system and may be affected by illness or medicines.",
    rangeUnavailable: "The source did not provide a reference range.",
    nextStep: "Follow care-team instructions for medication and blood-count monitoring.",
  },
  "777-3": {
    plainLanguageName: "Platelet count",
    category: "blood-count",
    whatItChecks: "Platelets help blood clot.",
    rangeUnavailable: "The source did not provide a reference range.",
    nextStep: "Review unexpected changes with your care team.",
  },
};

export const UNKNOWN_LAB_EXPLANATION: LabExplanation = {
  plainLanguageName: "Clinical laboratory result",
  category: "other",
  whatItChecks: "This result is part of your clinical record.",
  rangeUnavailable: "We do not have enough structured information to explain or classify this result safely.",
  nextStep: "Ask your care team what this result means for you.",
};

