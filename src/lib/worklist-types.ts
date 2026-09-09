/** Shared between the server (worklist.ts) and the client dashboard — no DOM/Bun-specific APIs here. */

export type AttentionReason =
  | "possible-worsening-renal-pattern"
  | "overdue-high-priority-task"
  | "proteinuria-monitoring-overdue"
  | "requires-review"
  | "serology-change"
  | "insufficient-data";

export type MonitoringStatus = "current" | "overdue" | "insufficient-data";

export interface WorklistObservationValue {
  value: number;
  unit?: string;
  date?: string;
}

export interface WorklistPatientView {
  patient: fhir4.Patient;
  name: string;
  age?: number;
  gender?: string;
  active: boolean;
  hasCopd: boolean;
  hasLupusNephritis: boolean;
  primaryConditionText?: string;
  latestUpcr?: WorklistObservationValue;
  latestEgfr?: WorklistObservationValue;
  monitoringStatus: MonitoringStatus;
  openTaskCount: number;
  hasOverdueHighPriorityTask: boolean;
  attentionReasons: AttentionReason[];
  primaryAttentionReason?: AttentionReason;
  lastUpdated?: string;
}

export interface WorklistSummary {
  totalPatients: number;
  lupusNephritisPatients: number;
  needsReview: number;
  monitoringOverdue: number;
  openHighPriorityTasks: number;
  insufficientData: number;
}

export interface ClinicianWorklistResponse {
  summary: WorklistSummary;
  attentionQueue: WorklistPatientView[];
  allPatients: WorklistPatientView[];
  partial: {
    conditions: boolean;
    observations: boolean;
    tasks: boolean;
  };
  generatedAt: string;
}

export const ATTENTION_REASON_LABELS: Record<AttentionReason, string> = {
  "possible-worsening-renal-pattern": "Possible worsening renal pattern",
  "overdue-high-priority-task": "Overdue high-priority task",
  "proteinuria-monitoring-overdue": "Monitoring overdue",
  "requires-review": "Requires clinician review",
  "serology-change": "Serology change",
  "insufficient-data": "Insufficient data",
};

export const ATTENTION_REASON_PRIORITY: AttentionReason[] = [
  "possible-worsening-renal-pattern",
  "overdue-high-priority-task",
  "proteinuria-monitoring-overdue",
  "requires-review",
  "serology-change",
  "insufficient-data",
];
