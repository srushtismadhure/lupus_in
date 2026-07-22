/**
 * Medication-management configuration — categories, monitoring intervals, and CDS safety rules.
 *
 * IMPORTANT: everything in this file is a DEMONSTRATION ruleset for a hackathon-scale app with
 * two synthetic patients. It is not a validated drug-interaction database, not pharmacy-grade,
 * and must not be used for real clinical decisions without institutional and clinical review.
 * Medication classification below is keyword-based text matching (there is no terminology
 * service in this project), which is a known limitation — see README/final report.
 */
import { LOINC_CODES } from "./fhir-observations.js";

export const RULESET_VERSION = "2026-07-demo-1";

// ---------------------------------------------------------------------------
// Medication categories (section 6) — keyword-matched against medication display text.
// ---------------------------------------------------------------------------

export type MedicationCategoryGroup = "lupus-nephritis-treatment" | "kidney-cardiovascular-support" | "preventive-supportive-care" | "other";

export interface MedicationCategory {
  id: string;
  group: MedicationCategoryGroup;
  label: string;
  keywords: string[];
}

export const MEDICATION_CATEGORIES: MedicationCategory[] = [
  { id: "glucocorticoids", group: "lupus-nephritis-treatment", label: "Glucocorticoids", keywords: ["prednisone", "prednisolone", "methylprednisolone", "dexamethasone", "solu-medrol", "corticosteroid", "glucocorticoid"] },
  { id: "mycophenolate", group: "lupus-nephritis-treatment", label: "Mycophenolate / mycophenolic acid", keywords: ["mycophenolate", "mycophenolic acid", "cellcept", "myfortic"] },
  { id: "cyclophosphamide", group: "lupus-nephritis-treatment", label: "Cyclophosphamide", keywords: ["cyclophosphamide", "cytoxan"] },
  { id: "belimumab", group: "lupus-nephritis-treatment", label: "Belimumab", keywords: ["belimumab", "benlysta"] },
  { id: "calcineurin-inhibitors", group: "lupus-nephritis-treatment", label: "Calcineurin inhibitors", keywords: ["tacrolimus", "cyclosporine", "ciclosporin", "voclosporin", "envarsus", "astagraf"] },
  { id: "hydroxychloroquine", group: "lupus-nephritis-treatment", label: "Hydroxychloroquine", keywords: ["hydroxychloroquine", "plaquenil"] },
  { id: "antihypertensives", group: "kidney-cardiovascular-support", label: "Antihypertensives", keywords: ["lisinopril", "losartan", "valsartan", "amlodipine", "enalapril", "ramipril", "irbesartan", "olmesartan", "angiotensin", "ace inhibitor", "arb"] },
  { id: "diuretics", group: "kidney-cardiovascular-support", label: "Diuretics", keywords: ["furosemide", "hydrochlorothiazide", "spironolactone", "torsemide", "bumetanide", "chlorthalidone"] },
  { id: "infection-prophylaxis", group: "preventive-supportive-care", label: "Infection prophylaxis", keywords: ["sulfamethoxazole", "trimethoprim", "bactrim", "septra", "pneumocystis", "prophylaxis", "dapsone", "atovaquone"] },
  { id: "bone-health", group: "preventive-supportive-care", label: "Bone-health support", keywords: ["calcium", "vitamin d", "cholecalciferol", "alendronate", "risedronate", "bisphosphonate"] },
  { id: "gastroprotection", group: "preventive-supportive-care", label: "Gastroprotection", keywords: ["omeprazole", "pantoprazole", "esomeprazole", "proton pump", "ranitidine", "famotidine"] },
];

export function categorizeMedicationText(text: string): MedicationCategory | undefined {
  const lower = text.toLowerCase();
  return MEDICATION_CATEGORIES.find(category => category.keywords.some(keyword => lower.includes(keyword)));
}

export const CATEGORY_GROUP_LABELS: Record<MedicationCategoryGroup, string> = {
  "lupus-nephritis-treatment": "Lupus-nephritis treatment",
  "kidney-cardiovascular-support": "Kidney and cardiovascular support",
  "preventive-supportive-care": "Preventive or supportive care",
  other: "Other documented medications",
};

// ---------------------------------------------------------------------------
// Monitoring requirements per category (section 6 "related safety-monitoring status")
// ---------------------------------------------------------------------------

export const LOINC_CBC_PANEL = "58410-2"; // CBC panel - Blood by Automated count

export interface MonitoringRequirement {
  categoryId: string;
  label: string;
  loincCode?: string;
  intervalDays?: number;
  unavailableReason?: string;
}

export const MONITORING_REQUIREMENTS: MonitoringRequirement[] = [
  { categoryId: "mycophenolate", label: "CBC", loincCode: LOINC_CBC_PANEL, intervalDays: 90 },
  { categoryId: "cyclophosphamide", label: "CBC", loincCode: LOINC_CBC_PANEL, intervalDays: 30 },
  { categoryId: "calcineurin-inhibitors", label: "Kidney function", loincCode: LOINC_CODES.serumCreatinine, intervalDays: 90 },
  { categoryId: "hydroxychloroquine", label: "Ophthalmologic exam", unavailableReason: "Monitoring unavailable" },
  { categoryId: "antihypertensives", label: "Blood pressure", loincCode: LOINC_CODES.bloodPressurePanel, intervalDays: 60 },
  { categoryId: "diuretics", label: "Blood pressure", loincCode: LOINC_CODES.bloodPressurePanel, intervalDays: 60 },
];

// ---------------------------------------------------------------------------
// CDS safety rules (section 16) — demonstration rules requiring institutional/clinical validation.
// ---------------------------------------------------------------------------

export type CdsRuleSeverity = "high" | "moderate" | "low";

export interface CdsRuleDefinition {
  id: string;
  version: string;
  severity: CdsRuleSeverity;
  summary: string;
  detail: string;
  suggestedActions: string[];
  disclaimer: string;
}

export const MEDICATION_CDS_RULES: Record<string, CdsRuleDefinition> = {
  "allergy-conflict": {
    id: "allergy-conflict",
    version: RULESET_VERSION,
    severity: "high",
    summary: "Medication-allergy conflict requires review",
    detail: "The selected medication matches a documented allergy or intolerance for this patient.",
    suggestedActions: ["Review medication safety", "Modify draft"],
    disclaimer: "Demonstration rule — matches on documented allergy text only, not a pharmacy allergy-cross-reactivity database.",
  },
  "pregnancy-mycophenolate": {
    id: "pregnancy-mycophenolate",
    version: RULESET_VERSION,
    severity: "high",
    summary: "Mycophenolate and documented pregnancy require review",
    detail: "Mycophenolate is teratogenic. Documented pregnancy-related information was found for this patient.",
    suggestedActions: ["Review medication safety", "Modify draft"],
    disclaimer: "Demonstration rule — requires clinical and institutional validation before real use.",
  },
  "hydroxychloroquine-qt-combo": {
    id: "hydroxychloroquine-qt-combo",
    version: RULESET_VERSION,
    severity: "moderate",
    summary: "Possible QT-prolonging medication combination",
    detail: "Hydroxychloroquine and another configured QT-prolonging medication both appear active for this patient.",
    suggestedActions: ["Review medication safety", "Modify draft"],
    disclaimer: "Demonstration rule using a short configured list, not a complete QT-prolongation database.",
  },
  "duplicate-active-medication": {
    id: "duplicate-active-medication",
    version: RULESET_VERSION,
    severity: "moderate",
    summary: "Possible duplicate active medication order",
    detail: "Another active MedicationRequest for the same medication category was found for this patient.",
    suggestedActions: ["Review medication safety", "Modify draft"],
    disclaimer: "Demonstration rule — matches by keyword category, not exact product/formulation.",
  },
  "request-statement-discrepancy": {
    id: "request-statement-discrepancy",
    version: RULESET_VERSION,
    severity: "low",
    summary: "Medication reconciliation issue",
    detail: "The active order and the patient-reported medication use do not match.",
    suggestedActions: ["Reconcile", "Contact patient"],
    disclaimer: "Demonstration rule — compares dose/status text only.",
  },
  "refill-interruption": {
    id: "refill-interruption",
    version: RULESET_VERSION,
    severity: "moderate",
    summary: "Documented refill interruption or nonadherence",
    detail: "The patient-reported medication use indicates an interruption, access barrier, or nonadherence.",
    suggestedActions: ["Contact patient", "Escalate"],
    disclaimer: "Demonstration rule based on structured nurse-documented notes.",
  },
  "monitoring-overdue": {
    id: "monitoring-overdue",
    version: RULESET_VERSION,
    severity: "moderate",
    summary: "Configured medication-safety monitoring overdue",
    detail: "A configured monitoring laboratory for this medication has not been recorded within the expected interval.",
    suggestedActions: ["Review medication safety", "Create monitoring task"],
    disclaimer: "Demonstration monitoring intervals — not institution-validated.",
  },
};

/** Configured QT-prolonging medications checked against hydroxychloroquine (demo list only, not exhaustive). */
export const QT_PROLONGING_KEYWORDS = ["azithromycin", "ciprofloxacin", "ondansetron", "sotalol", "amiodarone"];

/** Keyword hints for detecting documented pregnancy in Condition/Observation text (demo heuristic). */
export const PREGNANCY_KEYWORDS = ["pregnant", "pregnancy"];

/** Keyword hints for detecting nonadherence/refill interruption in structured MedicationStatement notes. */
export const NONADHERENCE_KEYWORDS = ["refill", "ran out", "stopped taking", "could not afford", "access difficulty", "missed dose"];

// ---------------------------------------------------------------------------
// Demo medication terminology reference (section 8: coded medication search).
// There is no live RxNorm/terminology service in this project — this is a small,
// unverified demo reference list so the "Add medication" search shows a name
// while a code is stored underneath, per the spec. Codes must be verified
// against a real terminology service before any institutional use.
// ---------------------------------------------------------------------------

export interface MedicationTerminologyEntry {
  display: string;
  system: string;
  code: string;
}

const RXNORM_SYSTEM = "http://www.nlm.nih.gov/research/umls/rxnorm";

export const DEMO_MEDICATION_TERMINOLOGY: MedicationTerminologyEntry[] = [
  { display: "Prednisone", system: RXNORM_SYSTEM, code: "8640" },
  { display: "Methylprednisolone", system: RXNORM_SYSTEM, code: "6902" },
  { display: "Mycophenolate mofetil", system: RXNORM_SYSTEM, code: "42375" },
  { display: "Mycophenolic acid", system: RXNORM_SYSTEM, code: "262076" },
  { display: "Cyclophosphamide", system: RXNORM_SYSTEM, code: "3002" },
  { display: "Belimumab", system: RXNORM_SYSTEM, code: "1201335" },
  { display: "Tacrolimus", system: RXNORM_SYSTEM, code: "42316" },
  { display: "Voclosporin", system: RXNORM_SYSTEM, code: "2472381" },
  { display: "Hydroxychloroquine", system: RXNORM_SYSTEM, code: "5521" },
  { display: "Lisinopril", system: RXNORM_SYSTEM, code: "29046" },
  { display: "Losartan", system: RXNORM_SYSTEM, code: "52175" },
  { display: "Furosemide", system: RXNORM_SYSTEM, code: "4603" },
  { display: "Sulfamethoxazole / trimethoprim", system: RXNORM_SYSTEM, code: "10831" },
  { display: "Calcium carbonate with vitamin D", system: RXNORM_SYSTEM, code: "202589" },
  { display: "Omeprazole", system: RXNORM_SYSTEM, code: "7646" },
];
