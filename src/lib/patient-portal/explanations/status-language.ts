import type { PatientLabStatus, PatientLabTrend } from "../types.js";

export const LAB_STATUS_LABELS: Record<PatientLabStatus, string> = {
  "within-reported-range": "Within the reported reference range",
  "outside-reported-range": "Outside the reported reference range",
  "awaiting-review": "Waiting for care-team review",
  reviewed: "Care team reviewed",
  "range-unavailable": "Reference range not provided",
  "insufficient-data": "Not enough information",
};

export const LAB_TREND_LABELS: Record<PatientLabTrend, string> = {
  improving: "Improving",
  worsening: "Changing away from the recent baseline",
  stable: "Stable",
  changing: "Changing",
  "insufficient-data": "Not enough comparable results",
  "not-applicable": "Trend not available",
};

export const CARE_PATHWAY_PATIENT_STATUS: Record<string, string> = {
  suggested: "Being reviewed by your care team",
  "awaiting-clinician-review": "Waiting for care-team approval",
  approved: "Approved",
  "referral-sent": "Referral sent",
  scheduling: "Scheduling in progress",
  scheduled: "Scheduled",
  "in-progress": "In progress",
  completed: "Completed",
  closed: "Finished",
  deferred: "Planned for later",
  declined: "Not moving forward",
  blocked: "Delayed by an unresolved issue",
};

