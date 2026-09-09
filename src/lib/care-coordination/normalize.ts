import { OPEN_TASK_STATUSES } from "../clinical-config.js";
import { formatConditionText, formatPatientName, isRenalDiagnosisCondition } from "../formatters.js";
import { CARE_COORDINATION_SERVICE_CODES } from "../terminology/care-coordination-codes.js";
import { normalizeCareTeam } from "./care-team.js";
import { evaluateCarePathwayRules, pathwayTypeForServiceRequest } from "./pathway-rules.js";
import { buildCoordinationTimeline } from "./timeline.js";
import type {
  CareCoordinationPlan,
  CareCoordinationRawData,
  CarePathway,
  CarePathwayProposal,
  CarePathwayStatus,
  CarePathwayType,
  CoordinationAppointment,
  CoordinationBarrier,
  CoordinationTask,
  PathwayChecklistItem,
} from "./types.js";

const OPEN_STATUSES = new Set<string>(OPEN_TASK_STATUSES);
const CLOSED_PATHWAY_STATUSES = new Set<CarePathwayStatus>(["completed", "closed", "declined"]);

function canonicalReference(reference: string | undefined): string | undefined {
  if (!reference) return undefined;
  const match = reference.match(/(?:^|\/)([A-Za-z]+)\/([^/]+)$/);
  return match ? `${match[1]}/${match[2]}` : reference;
}

function resolvedDisplay(
  reference: fhir4.Reference | undefined,
  resolved: CareCoordinationRawData["resolvedReferences"],
  fallback: string,
): string {
  const canonical = canonicalReference(reference?.reference);
  return reference?.display ?? (canonical ? resolved[canonical]?.display : undefined) ?? fallback;
}

export function normalizeCoordinationTask(
  task: fhir4.Task,
  resolved: CareCoordinationRawData["resolvedReferences"] = {},
  now = new Date(),
): CoordinationTask {
  const dueDate = task.restriction?.period?.end ?? task.executionPeriod?.end;
  const completionEvidence = (task.output ?? [])
    .map(output => output.valueReference?.display ?? output.valueReference?.reference ?? output.valueString)
    .filter((value): value is string => Boolean(value));
  const businessStatus = task.businessStatus?.text ?? task.businessStatus?.coding?.[0]?.display;
  const blockingReason = task.status === "on-hold" || /block|barrier|waiting/i.test(businessStatus ?? "") ? businessStatus : undefined;

  return {
    id: task.id ?? `task-${task.description ?? "coordination"}`,
    reference: task.id ? `Task/${task.id}` : undefined,
    description: task.description ?? task.code?.text ?? "Coordination task",
    status: task.status,
    priority: task.priority ?? "routine",
    ownerReference: canonicalReference(task.owner?.reference),
    ownerDisplay: resolvedDisplay(task.owner, resolved, "Unassigned"),
    dueDate,
    overdue: Boolean(dueDate && OPEN_STATUSES.has(task.status) && new Date(dueDate).getTime() < now.getTime()),
    focusReference: canonicalReference(task.focus?.reference),
    lastUpdated: task.meta?.lastUpdated ?? task.authoredOn,
    blockingReason,
    completionEvidence,
  };
}

export function normalizeCoordinationAppointment(appointment: fhir4.Appointment): CoordinationAppointment {
  return {
    id: appointment.id ?? `appointment-${appointment.start ?? "unscheduled"}`,
    reference: appointment.id ? `Appointment/${appointment.id}` : undefined,
    title: appointment.description ?? appointment.serviceType?.[0]?.text ?? "Care appointment",
    status: appointment.status,
    start: appointment.start,
    end: appointment.end,
    participants: (appointment.participant ?? [])
      .map(participant => participant.actor?.display)
      .filter((display): display is string => Boolean(display)),
    serviceRequestReferences: (appointment.basedOn ?? [])
      .map(item => canonicalReference(item.reference))
      .filter((reference): reference is string => Boolean(reference)),
  };
}

function taskFocusesOn(task: CoordinationTask, serviceRequestReference: string): boolean {
  return canonicalReference(task.focusReference) === canonicalReference(serviceRequestReference);
}

function appointmentForRequest(appointment: CoordinationAppointment, reference: string): boolean {
  return appointment.serviceRequestReferences.some(item => canonicalReference(item) === canonicalReference(reference));
}

function encounterForRequest(encounter: fhir4.Encounter, reference: string): boolean {
  return encounter.basedOn?.some(item => canonicalReference(item.reference) === canonicalReference(reference)) ?? false;
}

function statusFromResources(
  request: fhir4.ServiceRequest,
  tasks: CoordinationTask[],
  appointments: CoordinationAppointment[],
  encounters: fhir4.Encounter[],
): CarePathwayStatus {
  if (request.status === "entered-in-error") return "closed";
  if (request.status === "revoked") return "declined";
  if (request.status === "draft") return "awaiting-clinician-review";
  if (request.status === "on-hold") return "deferred";

  const completedEncounter = encounters.some(encounter => encounter.status === "finished");
  if (request.status === "completed" && completedEncounter) return "completed";
  if (tasks.some(task => task.blockingReason)) return "blocked";
  if (appointments.some(appointment => ["booked", "arrived", "fulfilled"].includes(appointment.status))) return "scheduled";
  if (tasks.some(task => task.status === "in-progress")) return "scheduling";
  if (request.status === "active") return tasks.length > 0 ? "referral-sent" : "approved";
  if (request.status === "completed") return "in-progress";
  return "in-progress";
}

function checklistFor(
  status: CarePathwayStatus,
  owner: string,
  destination: string | undefined,
  appointments: CoordinationAppointment[],
): PathwayChecklistItem[] {
  const approved = !["suggested", "awaiting-clinician-review"].includes(status);
  const closed = CLOSED_PATHWAY_STATUSES.has(status);
  return [
    { id: "review", label: "Clinician review", state: approved || closed ? "completed" : "pending" },
    { id: "destination", label: "Destination selected", state: destination ? "completed" : approved ? "pending" : "not-applicable" },
    { id: "owner", label: "Coordinator assigned", state: owner !== "Unassigned" ? "completed" : "pending" },
    {
      id: "appointment",
      label: "Service scheduled",
      state: appointments.some(appointment => ["booked", "arrived", "fulfilled"].includes(appointment.status))
        ? "completed"
        : status === "blocked"
          ? "blocked"
          : approved
            ? "pending"
            : "not-applicable",
    },
    { id: "closed", label: "Result returned to care plan", state: closed ? "completed" : "pending" },
  ];
}

function requestEvidence(request: fhir4.ServiceRequest): CarePathway["evidence"] {
  return (request.supportingInfo ?? []).map(item => ({
    label: item.display ?? item.reference ?? "Supporting clinical evidence",
    resourceReference: canonicalReference(item.reference),
  }));
}

function existingPathway(
  request: fhir4.ServiceRequest,
  raw: CareCoordinationRawData,
  tasks: CoordinationTask[],
  appointments: CoordinationAppointment[],
  now: Date,
): CarePathway {
  const pathwayType = pathwayTypeForServiceRequest(request);
  const reference = `ServiceRequest/${request.id ?? "unidentified"}`;
  const relatedTasks = tasks.filter(task => taskFocusesOn(task, reference));
  const relatedAppointments = appointments.filter(appointment => appointmentForRequest(appointment, reference));
  const relatedEncounters = raw.encounters.filter(encounter => encounterForRequest(encounter, reference));
  const status = statusFromResources(request, relatedTasks, relatedAppointments, relatedEncounters);
  const owner = relatedTasks.find(task => task.ownerDisplay !== "Unassigned")?.ownerDisplay ?? "Unassigned";
  const destination = request.performer?.[0]
    ? resolvedDisplay(request.performer[0], raw.resolvedReferences, "Destination not named")
    : undefined;
  const dueDate = relatedTasks.map(task => task.dueDate).filter((date): date is string => Boolean(date)).sort()[0];
  const title = request.code?.text ?? request.code?.coding?.[0]?.display ?? CARE_COORDINATION_SERVICE_CODES[pathwayType].display;
  const reason = request.reasonReference?.map(item => item.display).filter(Boolean).join("; ") || "Existing FHIR referral.";
  const supportingDiagnoses = request.reasonReference?.map(item => item.display).filter((value): value is string => Boolean(value)) ?? [];
  const latestUpdate = [request.meta?.lastUpdated, ...relatedTasks.map(task => task.lastUpdated), ...relatedAppointments.map(item => item.start)]
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop();
  const timeline = buildCoordinationTimeline(raw).filter(item => {
    if (item.resourceReference === reference) return true;
    return relatedTasks.some(task => task.reference === item.resourceReference) || relatedAppointments.some(appointment => appointment.reference === item.resourceReference);
  });

  return {
    id: request.id ?? reference,
    pathwayType,
    title,
    status,
    urgency: request.priority === "urgent" || request.priority === "asap" || request.priority === "stat" ? "urgent" : "routine",
    reason,
    evidence: requestEvidence(request),
    supportingDiagnoses,
    requiresClinicianApproval: request.status === "draft",
    suggestedBy: request.status === "draft" ? "Waypoint Care Coordination" : undefined,
    orderingClinician: request.requester ? resolvedDisplay(request.requester, raw.resolvedReferences, "Clinician not named") : undefined,
    owner,
    destination,
    destinationReference: canonicalReference(request.performer?.[0]?.reference),
    referralStatus: request.status,
    serviceRequestReference: request.id ? reference : undefined,
    dueDate,
    overdue: relatedTasks.some(task => task.overdue),
    missingRequirements: [!destination ? "Destination service" : null, owner === "Unassigned" ? "Assigned coordinator" : null]
      .filter((value): value is string => Boolean(value)),
    latestUpdate,
    nextAction:
      status === "awaiting-clinician-review"
        ? "Review and decide whether to refer"
        : status === "blocked"
          ? "Resolve the documented barrier"
          : status === "scheduled"
            ? "Confirm completion documentation"
            : status === "completed"
              ? "No action required"
              : owner === "Unassigned"
                ? "Assign a coordinator"
                : "Coordinate the next service step",
    tasks: relatedTasks,
    appointments: relatedAppointments,
    checklist: checklistFor(status, owner, destination, relatedAppointments),
    timeline,
  };
}

function proposalPathway(proposal: CarePathwayProposal, raw: CareCoordinationRawData): CarePathway {
  const title = CARE_COORDINATION_SERVICE_CODES[proposal.pathwayType].display;
  const diagnoses = proposal.evidence
    .filter(item => item.resourceReference?.startsWith("Condition/"))
    .map(item => item.label);
  const timeline = [
    {
      id: `proposal-${proposal.sourceRuleId}`,
      timestamp: raw.patient.meta?.lastUpdated ?? new Date().toISOString(),
      eventType: "proposal-created" as const,
      title: `${title} suggested for review`,
      detail: proposal.reason,
    },
  ];
  return {
    id: `proposal-${proposal.pathwayType}`,
    pathwayType: proposal.pathwayType,
    title,
    status: "awaiting-clinician-review",
    urgency: proposal.urgency,
    reason: proposal.reason,
    evidence: proposal.evidence,
    supportingDiagnoses: diagnoses,
    requiresClinicianApproval: true,
    suggestedBy: "Waypoint Care Coordination",
    owner: "Unassigned",
    overdue: false,
    missingRequirements: ["Clinician approval", "Destination service", "Assigned coordinator"],
    nextAction: "Review and refer",
    tasks: [],
    appointments: [],
    checklist: checklistFor("awaiting-clinician-review", "Unassigned", undefined, []),
    timeline,
    sourceRuleId: proposal.sourceRuleId,
    ruleVersion: proposal.ruleVersion,
  };
}

function barriersFromResources(raw: CareCoordinationRawData, tasks: CoordinationTask[]): CoordinationBarrier[] {
  const barriers: CoordinationBarrier[] = [];
  for (const task of tasks.filter(task => task.blockingReason)) {
    barriers.push({
      id: `task-barrier-${task.id}`,
      category: "Workflow barrier",
      status: task.status === "completed" ? "resolved" : "active",
      description: task.blockingReason!,
      sourceReference: task.reference,
      ownerReference: task.ownerReference,
      identifiedAt: task.lastUpdated,
    });
  }
  for (const request of raw.serviceRequests) {
    for (const [index, note] of (request.note ?? []).entries()) {
      const match = note.text?.match(/^\[barrier\]\s*(.+)$/i);
      if (!match?.[1]) continue;
      barriers.push({
        id: `request-barrier-${request.id ?? index}-${index}`,
        category: "Access barrier",
        status: request.status === "completed" ? "resolved" : "active",
        description: match[1],
        sourceReference: request.id ? `ServiceRequest/${request.id}` : undefined,
        identifiedAt: note.time,
      });
    }
  }
  return barriers;
}

function carePlanStatus(carePlan: fhir4.CarePlan | undefined): CareCoordinationPlan["status"] {
  if (!carePlan) return "draft";
  if (carePlan.status === "on-hold") return "on-hold";
  if (carePlan.status === "completed") return "completed";
  if (carePlan.status === "revoked" || carePlan.status === "entered-in-error") return "cancelled";
  return carePlan.status === "active" ? "active" : "draft";
}

export function buildCareCoordinationPlan(raw: CareCoordinationRawData, now = new Date()): CareCoordinationPlan {
  const tasks = raw.tasks.map(task => normalizeCoordinationTask(task, raw.resolvedReferences, now));
  const appointments = raw.appointments.map(normalizeCoordinationAppointment);
  const rules = evaluateCarePathwayRules(raw, now);
  const existing = raw.serviceRequests.map(request => existingPathway(request, raw, tasks, appointments, now));
  const existingTypes = new Set(existing.filter(pathway => !CLOSED_PATHWAY_STATUSES.has(pathway.status)).map(pathway => pathway.pathwayType));
  const proposals = rules.proposals.filter(proposal => !existingTypes.has(proposal.pathwayType)).map(proposal => proposalPathway(proposal, raw));
  const pathways = [...proposals, ...existing].sort((a, b) => {
    if (a.requiresClinicianApproval !== b.requiresClinicianApproval) return a.requiresClinicianApproval ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
  const careTeam = normalizeCareTeam(raw.careTeams, tasks, raw.resolvedReferences);
  const activeTasks = tasks.filter(task => OPEN_STATUSES.has(task.status));
  const upcomingAppointments = appointments
    .filter(appointment => appointment.start && new Date(appointment.start).getTime() >= now.getTime() && !["cancelled", "entered-in-error"].includes(appointment.status))
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  const barriers = barriersFromResources(raw, tasks);
  const renalDiagnosis = raw.conditions.find(isRenalDiagnosisCondition);
  const activeCarePlan = raw.carePlans.find(plan => plan.status === "active") ?? raw.carePlans[0];
  const coordinator = careTeam.find(member => member.roleCode === "care-coordinator" || member.roleCode === "renal-nurse");
  const lastUpdatedAt = [
    raw.patient.meta?.lastUpdated,
    ...raw.serviceRequests.map(resource => resource.meta?.lastUpdated ?? resource.authoredOn),
    ...raw.tasks.map(resource => resource.meta?.lastUpdated ?? resource.authoredOn),
    ...raw.appointments.map(resource => resource.meta?.lastUpdated ?? resource.start),
  ]
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop() ?? now.toISOString();

  return {
    patientId: raw.patient.id ?? "",
    patientName: formatPatientName(raw.patient),
    patientIdentifier: raw.patient.identifier?.[0]?.value,
    primaryRenalDiagnosis: renalDiagnosis ? formatConditionText(renalDiagnosis) : undefined,
    carePlanId: activeCarePlan?.id,
    status: carePlanStatus(activeCarePlan),
    assignedCoordinator: coordinator?.name ?? "Unassigned",
    lastUpdatedAt,
    summary: {
      activePathways: pathways.filter(pathway => !CLOSED_PATHWAY_STATUSES.has(pathway.status)).length,
      pendingClinicianApprovals: pathways.filter(pathway => pathway.requiresClinicianApproval).length,
      overdueTasks: activeTasks.filter(task => task.overdue).length,
      upcomingAppointments: upcomingAppointments.length,
      closedPathways: pathways.filter(pathway => CLOSED_PATHWAY_STATUSES.has(pathway.status)).length,
    },
    careTeam,
    pathways,
    activeTasks,
    upcomingAppointments,
    barriers,
    timeline: buildCoordinationTimeline(raw),
    dataStatus: {
      complete: raw.failedSections.length === 0,
      failedSections: raw.failedSections,
      insufficientEvidence: rules.insufficientEvidence,
    },
  };
}
