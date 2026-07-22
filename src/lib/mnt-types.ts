/** Shared between the server (mnt.ts) and the client — no DOM/Bun-specific APIs here. */

export type MntReferralStatus =
  | "not-assessed"
  | "referral-suggested"
  | "draft-prepared"
  | "awaiting-clinician-signature"
  | "active-referral"
  | "scheduling-in-progress"
  | "appointment-scheduled"
  | "completed"
  | "declined"
  | "unable-to-reach-patient";

export const MNT_STATUS_LABELS: Record<MntReferralStatus, string> = {
  "not-assessed": "Not assessed",
  "referral-suggested": "MNT referral suggested",
  "draft-prepared": "Draft prepared",
  "awaiting-clinician-signature": "Awaiting clinician signature",
  "active-referral": "Active referral",
  "scheduling-in-progress": "Scheduling in progress",
  "appointment-scheduled": "Appointment scheduled",
  completed: "Completed",
  declined: "Declined",
  "unable-to-reach-patient": "Unable to reach patient",
};

export type PatientWillingness = "interested" | "declined" | "unknown";

export type NextResponsible = "nurse" | "clinician" | "dietitian" | "none";

export interface MntSuggestion {
  suggested: boolean;
  matchedReasons: string[];
}

export interface MntReferralView {
  serviceRequestId: string;
  patientId: string;
  status: MntReferralStatus;
  reasonText?: string;
  referringClinician?: string;
  signingClinician?: string;
  dietitian?: string;
  datePrepared?: string;
  dateSigned?: string;
  appointmentDate?: string;
  lastOutreach?: string;
  patientWillingness: PatientWillingness;
  accessBarriers: string[];
  declineReason?: string;
  nextResponsible: NextResponsible;
  reviewTaskStatus?: string;
  coordinationTaskStatus?: string;
  canSign: boolean;
}

export interface MntPatientState {
  patientId: string;
  patientName: string;
  referral: MntReferralView | null;
  suggestion: MntSuggestion;
}

export interface MntPopulationSummary {
  awaitingSignature: number;
  approvedAwaitingScheduling: number;
  notContacted: number;
  appointmentsScheduled: number;
  completed: number;
  blockedByBarriers: number;
}

export interface MntQueueItem {
  patientId: string;
  patientName: string;
  reasonText?: string;
  status: MntReferralStatus;
  ownerLabel: string;
  daysWaiting?: number;
  nextAction: string;
}

export interface MntWorklistResponse {
  summary: MntPopulationSummary;
  queue: MntQueueItem[];
  generatedAt: string;
}
