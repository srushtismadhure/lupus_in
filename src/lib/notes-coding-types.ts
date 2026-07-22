export const CLINICAL_CONCEPT_CATEGORIES = [
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
] as const;

export type ClinicalConceptCategory = (typeof CLINICAL_CONCEPT_CATEGORIES)[number];

export const TERMINOLOGY_SYSTEMS = ["SNOMED_CT", "ICD_10_CM", "ICD_10_CM_Z", "RXNORM", "LOINC"] as const;
export type TerminologySystem = (typeof TERMINOLOGY_SYSTEMS)[number];

export type ConceptPresenceStatus = "present" | "absent";
export type ConceptCertainty = "confirmed" | "suspected";
export type ConceptTemporality = "current" | "historical" | "resolved" | "planned" | "unknown";
export type ConceptSubject = "patient" | "family_member" | "other" | "unknown";
export type StatementKind = "clinical" | "administrative";
export type ConfidenceCategory = "high" | "medium" | "low" | "review-required";

export interface TerminologyCandidate {
  id: string;
  system: TerminologySystem;
  systemUri: string;
  code: string | null;
  display: string | null;
  validationStatus: "validated" | "no_match" | "unavailable";
  officialDisplay: string | null;
  terminologyService: string;
  terminologyVersion?: string;
  confidenceCategory: ConfidenceCategory;
  message: string;
}

export interface ClinicalConceptSuggestion {
  id: string;
  sourceText: string;
  normalizedConcept: string;
  category: ClinicalConceptCategory;
  status: ConceptPresenceStatus;
  certainty: ConceptCertainty;
  temporality: ConceptTemporality;
  subject: ConceptSubject;
  statementKind: StatementKind;
  associatedMedication?: string;
  suggestedTerminologySystems: TerminologySystem[];
  terminologyCandidates: TerminologyCandidate[];
  requiresClinicianReview: boolean;
  clinicalCaveat?: string;
  clinicianDecision?: {
    status: "approved" | "rejected" | "edited";
    decidedAt: string;
    decidedBy: string;
    selectedCandidateId?: string;
    createdResourceReferences?: string[];
    reason?: string;
    editedConcept?: string;
  };
}

export interface ClinicalNoteDraftPayload {
  version: 1;
  draftId?: string;
  patientId: string;
  encounterId?: string;
  noteText: string;
  noteDate: string;
  author: string;
  noteType: string;
  status: "draft" | "analyzed" | "finalized";
  model?: string;
  analysisMode?: "openai" | "not-run";
  analysisTimestamp?: string;
  concepts: ClinicalConceptSuggestion[];
  createdResourceReferences: string[];
  rejectedConceptIds: string[];
  provenanceReferences: string[];
}

export interface ClinicalNoteDraftView extends ClinicalNoteDraftPayload {
  draftId: string;
  fhirReference: string;
}

export interface AnalyzeClinicalNoteInput {
  noteText: string;
  encounterId?: string;
  noteDate: string;
  author: string;
  noteType: string;
}

export interface SaveClinicalNoteInput extends AnalyzeClinicalNoteInput {
  status?: "draft" | "analyzed" | "finalized";
}

export interface PriorAuthEvidenceItem {
  id: string;
  label: string;
  status: "found" | "missing" | "unverified";
  details: string;
  resourceType?: string;
  resourceId?: string;
  reference?: string;
}

export interface PriorAuthReadiness {
  patientId: string;
  draftId?: string;
  requestedTherapy: string | null;
  authorizationRequirement: "Payer verification pending";
  readinessState:
    | "Evidence gathering"
    | "Missing documentation"
    | "Payer verification needed"
    | "Ready for clinician review"
    | "Ready to prepare";
  reasonForEscalation: string | null;
  evidenceFound: PriorAuthEvidenceItem[];
  missingOrUnverified: PriorAuthEvidenceItem[];
  coding: PriorAuthEvidenceItem[];
  rationaleOptions: string[];
  generatedAt: string;
}

export interface SdohReferralOpportunity {
  id: string;
  conceptId: string;
  documentedBarrier: string;
  suggestedSupport: string;
  reason: string;
  resourceVerificationStatus: "pending" | "configured-directory" | "not-configured";
  approvedConceptRequired: boolean;
}

export interface ClinicalNoteAnalysisResponse {
  draft: ClinicalNoteDraftView;
  concepts: ClinicalConceptSuggestion[];
  priorAuthReadiness: PriorAuthReadiness;
  sdohOpportunities: SdohReferralOpportunity[];
  terminologyServiceConfigured: boolean;
  model: string;
}

export interface ApproveConceptInput {
  selectedCandidateId?: string;
  editedConcept?: string;
}

export interface RejectConceptInput {
  reason?: string;
}

export interface ConceptDecisionResponse {
  draft: ClinicalNoteDraftView;
  concept: ClinicalConceptSuggestion;
  createdResources: string[];
}

export interface SdohReferralDraftInput {
  conceptId?: string;
  documentedBarrier: string;
  supportType: string;
  organizationName?: string;
  organizationPhone?: string;
  organizationAddress?: string;
  note?: string;
}

export interface SdohReferralDraftResponse {
  serviceRequestId: string;
  patientId: string;
  status: fhir4.ServiceRequest["status"];
  documentedBarrier: string;
  supportType: string;
  organizationDisplay: string | null;
  verificationStatus: "pending" | "verified";
}

export interface CreatePriorAuthTaskInput {
  description: string;
  focusReference?: string;
}
