/** Shared clinical thresholds and codes — kept out of UI components so the rules are visible in one place. */

/** How often UPCR should be re-checked for a lupus-nephritis patient before monitoring is considered overdue. */
export const PROTEINURIA_MONITORING_INTERVAL_DAYS = 90;

export const LUPUS_NEPHRITIS_ICD10_CODE = "M32.14";

/** Task.status values that count as "open" (not yet resolved). */
export const OPEN_TASK_STATUSES = ["requested", "received", "accepted", "in-progress", "ready"] as const;

/** Task.priority values treated as high-priority for the attention queue. */
export const HIGH_PRIORITY_TASK_LEVELS = ["urgent", "asap", "stat"] as const;

// ---------------------------------------------------------------------------
// Medical Nutrition Therapy (MNT) referral — demonstration configuration only.
// These are illustrative thresholds/keywords for a hackathon demo, not a
// validated clinical decision-support ruleset. Every rule here is meant to be
// tuned per institution before any real use.
// ---------------------------------------------------------------------------

/** Condition.code.coding.code values (ICD-10-CM) treated as chronic kidney disease, in addition to lupus nephritis. */
export const CKD_ICD10_PREFIX = "N18";

export const MNT_SERVICE_REQUEST_TEXT = "Medical nutrition therapy referral";

export const LOINC_POTASSIUM = "2823-3";
export const LOINC_PHOSPHORUS = "2777-1";

/** Systolic BP (mm Hg) above which the demo suggestion rule flags a "blood-pressure concern". */
export const BP_CONCERN_SYSTOLIC_THRESHOLD = 140;

/** Keyword lists used by the (heuristic, text-based) MNT suggestion rules — see mnt.ts. */
export const EDEMA_OR_WEIGHT_CHANGE_KEYWORDS = ["edema", "oedema", "weight gain", "weight loss", "fluid overload"];
export const POOR_INTAKE_KEYWORDS = ["poor intake", "anorexia", "malnutrition", "unintended weight loss"];
export const PATIENT_CONFUSION_KEYWORDS = ["confusion about diet", "nutrition confusion", "unclear on diet"];
export const FOOD_INSECURITY_KEYWORDS = ["food insecurity", "food access", "unable to afford food"];
export const ADHERENCE_BARRIER_KEYWORDS = ["non-adherent", "nonadherent", "adherence barrier", "missed doses"];

/** Human-readable labels for the demo suggestion rules — keep in one place rather than buried in a component. */
export const MNT_SUGGESTION_RULE_LABELS = {
  renalDiagnosis: "Documented lupus nephritis or chronic kidney disease",
  noActiveReferral: "No active dietitian referral",
  bloodPressureConcern: "Blood-pressure concern",
  edemaOrWeightChange: "Documented edema or weight change",
  abnormalPotassiumOrPhosphorus: "Abnormal potassium or phosphorus result",
  poorIntake: "Poor intake or unintended weight change",
  patientConfusion: "Patient confusion about kidney-related nutrition",
  foodInsecurity: "Food insecurity or difficulty following the care plan",
  adherenceBarrier: "Medication or dietary adherence barrier",
} as const;
