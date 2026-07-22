import type { ClinicalNoteDraftView } from "../notes-coding-types.js";

export type SleSystemId =
  | "constitutional"
  | "renal"
  | "musculoskeletal"
  | "mucocutaneous"
  | "neuropsychiatric"
  | "cardiorespiratory"
  | "hematologic"
  | "gastrointestinal"
  | "ophthalmic";

export type SleBodyRegionId =
  | "whole-body"
  | "brain"
  | "eyes"
  | "skin"
  | "oral-cavity"
  | "heart"
  | "lungs"
  | "kidneys"
  | "gi-tract"
  | "joints"
  | "muscles"
  | "blood";

export type SleSystemStatus =
  | "current-activity"
  | "possible-activity"
  | "historical-involvement"
  | "no-current-evidence"
  | "assessment-incomplete"
  | "monitoring-due"
  | "unable-to-determine";

export type AssessmentCompleteness = "complete" | "partial" | "incomplete" | "not-assessed" | "monitoring-overdue" | "unknown";

export interface SleChecklistDefinition {
  id: string;
  label: string;
  evidenceKeywords: string[];
}

export interface SleSystemDefinition {
  id: SleSystemId;
  title: string;
  shortLabel: string;
  bodyRegions: SleBodyRegionId[];
  description: string;
  evidenceKeywords: string[];
  checklist: SleChecklistDefinition[];
}

export interface SleEvidenceItem {
  id: string;
  resourceType: string;
  resourceReference?: string;
  title: string;
  detail?: string;
  date?: string;
  source: string;
  temporalState: "current" | "historical" | "unknown";
  evidenceRole: "condition" | "monitoring" | "treatment" | "workflow" | "assessment" | "note";
}

export interface SleChecklistItem {
  id: string;
  label: string;
  state: "reviewed" | "documented" | "missing";
  evidenceReferences: string[];
}

export interface SlePendingNoteConcept {
  id: string;
  draftId: string;
  conceptId: string;
  systemId: SleSystemId;
  label: string;
  sourceText: string;
  noteDate: string;
  certainty: "confirmed" | "suspected";
  validatedCandidateId?: string;
  draftReference: string;
}

export interface SleOutstandingReviewItem {
  id: string;
  systemId: SleSystemId;
  systemTitle: string;
  label: string;
  reason: "assessment-incomplete" | "monitoring-overdue" | "note-review" | "missing-evidence";
}

export interface SleSystemReview {
  id: SleSystemId;
  title: string;
  shortLabel: string;
  description: string;
  bodyRegions: SleBodyRegionId[];
  status: SleSystemStatus;
  statusLabel: string;
  statusDetail: string;
  completeness: AssessmentCompleteness;
  completenessLabel: string;
  evidenceCompletionLabel: string;
  reviewedCount: number;
  documentedCount: number;
  totalCount: number;
  lastUpdated?: string;
  permanentDamageDocumented: boolean;
  currentEvidence: SleEvidenceItem[];
  historicalEvidence: SleEvidenceItem[];
  checklist: SleChecklistItem[];
  outstandingTasks: SleEvidenceItem[];
  pendingNoteConcepts: SlePendingNoteConcept[];
  nextActions: string[];
}

export interface SleSystemsReviewModel {
  patient: {
    id: string;
    name: string;
    identifier?: string;
    primaryDiagnosis?: string;
  };
  title: "Structured SLE Systems Review";
  generatedAt: string;
  systems: SleSystemReview[];
  summary: {
    currentActivity: number;
    possibleActivity: number;
    historicalInvolvement: number;
    assessmentIncomplete: number;
    monitoringDue: number;
    unableToDetermine: number;
  };
  assessment: {
    reviewed: number;
    documented: number;
    total: number;
    label: string;
  };
  outstandingReview: SleOutstandingReviewItem[];
  dataStatus: {
    complete: boolean;
    failedSections: string[];
  };
}

export interface SleSystemsRawData {
  patient: fhir4.Patient;
  conditions: fhir4.Condition[];
  observations: fhir4.Observation[];
  medicationRequests: fhir4.MedicationRequest[];
  medicationStatements: fhir4.MedicationStatement[];
  procedures: fhir4.Procedure[];
  diagnosticReports: fhir4.DiagnosticReport[];
  documentReferences: fhir4.DocumentReference[];
  compositions: fhir4.Composition[];
  questionnaireResponses: fhir4.QuestionnaireResponse[];
  tasks: fhir4.Task[];
  serviceRequests: fhir4.ServiceRequest[];
  adverseEvents: fhir4.AdverseEvent[];
  clinicalNoteDrafts: ClinicalNoteDraftView[];
  failedSections: string[];
}

export interface SubmitSleAssessmentInput {
  systemId: SleSystemId;
  reviewedItemIds: string[];
  note?: string;
}

