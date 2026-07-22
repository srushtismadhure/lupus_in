export type CarePathwayType =
  | "medical-nutrition-therapy"
  | "kidney-transplant-evaluation"
  | "dialysis-planning"
  | "renal-nurse-follow-up"
  | "generic";

export type CarePathwayStatus =
  | "suggested"
  | "awaiting-clinician-review"
  | "approved"
  | "referral-sent"
  | "scheduling"
  | "scheduled"
  | "in-progress"
  | "completed"
  | "closed"
  | "declined"
  | "deferred"
  | "blocked";

export type CarePathwayUrgency = "routine" | "soon" | "urgent";

export interface CareEvidence {
  label: string;
  resourceReference?: string;
  value?: string;
  date?: string;
  code?: string;
  codeSystem?: string;
}

export interface CarePathwayProposal {
  pathwayType: Exclude<CarePathwayType, "generic">;
  reason: string;
  evidence: CareEvidence[];
  urgency: CarePathwayUrgency;
  requiresClinicianApproval: true;
  sourceRuleId: string;
  ruleVersion: string;
}

export interface CoordinationTask {
  id: string;
  reference?: string;
  description: string;
  status: string;
  priority: string;
  ownerReference?: string;
  ownerDisplay: string;
  dueDate?: string;
  overdue: boolean;
  focusReference?: string;
  lastUpdated?: string;
  blockingReason?: string;
  completionEvidence: string[];
}

export interface CareTeamMember {
  id: string;
  reference?: string;
  name: string;
  role: string;
  roleCode: string;
  organization?: string;
  responsibilities: string[];
  openTaskCount: number;
}

export interface CoordinationAppointment {
  id: string;
  reference?: string;
  title: string;
  status: string;
  start?: string;
  end?: string;
  participants: string[];
  serviceRequestReferences: string[];
}

export interface CoordinationBarrier {
  id: string;
  category: string;
  status: "active" | "resolved";
  description: string;
  sourceReference?: string;
  ownerReference?: string;
  identifiedAt?: string;
  resolvedAt?: string;
}

export interface CoordinationEvent {
  id: string;
  timestamp: string;
  eventType:
    | "proposal-created"
    | "referral-approved"
    | "referral-sent"
    | "task-created"
    | "task-assigned"
    | "task-started"
    | "task-blocked"
    | "appointment-scheduled"
    | "communication-completed"
    | "encounter-completed"
    | "pathway-closed"
    | "pathway-deferred"
    | "pathway-declined";
  title: string;
  detail?: string;
  actorReference?: string;
  resourceReference?: string;
}

export interface PathwayChecklistItem {
  id: string;
  label: string;
  state: "completed" | "pending" | "blocked" | "not-applicable";
}

export interface CarePathway {
  id: string;
  pathwayType: CarePathwayType;
  title: string;
  status: CarePathwayStatus;
  urgency: CarePathwayUrgency;
  reason: string;
  evidence: CareEvidence[];
  supportingDiagnoses: string[];
  requiresClinicianApproval: boolean;
  suggestedBy?: string;
  orderingClinician?: string;
  owner: string;
  destination?: string;
  destinationReference?: string;
  referralStatus?: string;
  serviceRequestReference?: string;
  dueDate?: string;
  overdue: boolean;
  missingRequirements: string[];
  latestUpdate?: string;
  nextAction: string;
  tasks: CoordinationTask[];
  appointments: CoordinationAppointment[];
  checklist: PathwayChecklistItem[];
  timeline: CoordinationEvent[];
  sourceRuleId?: string;
  ruleVersion?: string;
}

export interface CareCoordinationSummary {
  activePathways: number;
  pendingClinicianApprovals: number;
  overdueTasks: number;
  upcomingAppointments: number;
  closedPathways: number;
}

export interface CareCoordinationPlan {
  patientId: string;
  patientName: string;
  patientIdentifier?: string;
  primaryRenalDiagnosis?: string;
  carePlanId?: string;
  status: "draft" | "active" | "on-hold" | "completed" | "cancelled";
  assignedCoordinator: string;
  lastUpdatedAt: string;
  summary: CareCoordinationSummary;
  careTeam: CareTeamMember[];
  pathways: CarePathway[];
  activeTasks: CoordinationTask[];
  upcomingAppointments: CoordinationAppointment[];
  barriers: CoordinationBarrier[];
  timeline: CoordinationEvent[];
  dataStatus: {
    complete: boolean;
    failedSections: string[];
    insufficientEvidence: string[];
  };
}

export interface CareCoordinationRawData {
  patient: fhir4.Patient;
  conditions: fhir4.Condition[];
  observations: fhir4.Observation[];
  serviceRequests: fhir4.ServiceRequest[];
  tasks: fhir4.Task[];
  carePlans: fhir4.CarePlan[];
  careTeams: fhir4.CareTeam[];
  goals: fhir4.Goal[];
  appointments: fhir4.Appointment[];
  encounters: fhir4.Encounter[];
  communications: fhir4.Communication[];
  resolvedReferences: Record<string, { display: string; resourceType: string }>;
  failedSections: string[];
}

export interface ReferralDestination {
  reference?: string;
  display: string;
}

export interface ReferralReviewInput {
  patientId: string;
  pathwayType: Exclude<CarePathwayType, "generic">;
  reason: string;
  evidence: CareEvidence[];
  reasonReferences: fhir4.Reference[];
  supportingInfo: fhir4.Reference[];
  clinician: fhir4.Reference;
  coordinator?: fhir4.Reference;
  destination?: ReferralDestination;
  dueDate?: string;
  approved: boolean;
  authoredOn: string;
  sourceRuleId: string;
  ruleVersion: string;
  existingCarePlan?: fhir4.CarePlan;
  existingCareTeam?: fhir4.CareTeam;
}

export interface CareCoordinationReferralPreview {
  serviceRequest: fhir4.ServiceRequest;
  task: fhir4.Task;
  carePlan: fhir4.CarePlan;
  careTeam: fhir4.CareTeam;
  provenance: fhir4.Provenance;
  transaction: fhir4.Bundle;
}
