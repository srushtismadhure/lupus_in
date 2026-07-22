export const CARE_COORDINATION_TERMINOLOGY_VERSION = "1.0.0";

export const CARE_COORDINATION_SYSTEMS = {
  service: "https://luppedin.health/fhir/CodeSystem/care-coordination-service",
  pathway: "https://luppedin.health/fhir/CodeSystem/care-coordination-pathway",
  role: "https://luppedin.health/fhir/CodeSystem/care-team-role",
  identifier: "https://luppedin.health/fhir/identifier/care-coordination",
} as const;

export const CARE_COORDINATION_SERVICE_CODES = {
  "medical-nutrition-therapy": {
    code: "medical-nutrition-therapy",
    display: "Medical Nutrition Therapy",
  },
  "kidney-transplant-evaluation": {
    code: "kidney-transplant-evaluation",
    display: "Kidney Transplant Evaluation",
  },
  "dialysis-planning": {
    code: "dialysis-planning-education",
    display: "Dialysis Planning and Education",
  },
  "renal-nurse-follow-up": {
    code: "renal-nurse-follow-up",
    display: "Renal Nurse Follow-up",
  },
  generic: {
    code: "existing-referral",
    display: "Existing referral",
  },
} as const;

export const CARE_TEAM_ROLE_CODES = {
  nephrologist: { code: "nephrologist", display: "Nephrologist" },
  "treating-clinician": { code: "treating-clinician", display: "Primary treating clinician" },
  "renal-nurse": { code: "renal-nurse", display: "Renal nurse" },
  "care-coordinator": { code: "care-coordinator", display: "Care coordinator" },
  dietitian: { code: "registered-dietitian", display: "Registered dietitian" },
  "transplant-coordinator": { code: "transplant-coordinator", display: "Transplant coordinator" },
  "social-worker": { code: "social-worker", display: "Social worker" },
  pharmacist: { code: "pharmacist", display: "Pharmacist" },
  organization: { code: "service-organization", display: "Service organization" },
  other: { code: "other", display: "Care team member" },
} as const;

export const TERMINOLOGY_REVIEW_NOTE =
  "Local LoopedIn terminology; review and map to institution-approved standard terminology before production use.";

