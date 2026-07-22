import {
  createFhirResource,
  fetchAllPages,
  readFhirResource,
  searchFhirResource,
  updateFhirResource,
} from "./fhir-server-client";
import {
  ADHERENCE_BARRIER_KEYWORDS,
  BP_CONCERN_SYSTOLIC_THRESHOLD,
  EDEMA_OR_WEIGHT_CHANGE_KEYWORDS,
  FOOD_INSECURITY_KEYWORDS,
  LOINC_PHOSPHORUS,
  LOINC_POTASSIUM,
  MNT_SERVICE_REQUEST_TEXT,
  MNT_SUGGESTION_RULE_LABELS,
  PATIENT_CONFUSION_KEYWORDS,
  POOR_INTAKE_KEYWORDS,
} from "./clinical-config";
import { LOINC_CODES, filterObservationsByLoinc, getLatestObservation, getObservationInterpretation } from "./fhir-observations";
import { formatConditionText, formatPatientName, isRenalDiagnosisCondition, referencesPatient } from "./formatters";
import type {
  MntPatientState,
  MntPopulationSummary,
  MntQueueItem,
  MntReferralStatus,
  MntReferralView,
  MntSuggestion,
  MntWorklistResponse,
  NextResponsible,
  PatientWillingness,
} from "./mnt-types";

const NOTE_TAG = {
  preparedBy: "[prepared-by]",
  willingness: "[willingness]",
  barrier: "[barrier]",
  outreach: "[outreach]",
  declineReason: "[decline-reason]",
  signed: "[signed]",
} as const;

function annotation(text: string, authorDisplay?: string): fhir4.Annotation {
  return { text, time: new Date().toISOString(), ...(authorDisplay ? { authorReference: { display: authorDisplay } } : {}) };
}

function isOperationOutcome(value: unknown): value is fhir4.OperationOutcome {
  return typeof value === "object" && value !== null && (value as { resourceType?: string }).resourceType === "OperationOutcome";
}

function isMntServiceRequest(serviceRequest: fhir4.ServiceRequest): boolean {
  return serviceRequest.code?.text === MNT_SERVICE_REQUEST_TEXT;
}

function isReviewTask(task: fhir4.Task): boolean {
  return task.description === REVIEW_TASK_DESCRIPTION;
}

function isCoordinationTask(task: fhir4.Task): boolean {
  return task.description === COORDINATION_TASK_DESCRIPTION;
}

const REVIEW_TASK_DESCRIPTION = "Review and sign MNT referral";
const COORDINATION_TASK_DESCRIPTION = "Schedule renal dietitian consultation and confirm appointment";

function taskFocusesOn(task: fhir4.Task, serviceRequestId: string): boolean {
  return task.focus?.reference === `ServiceRequest/${serviceRequestId}` || task.focus?.reference?.endsWith(`/ServiceRequest/${serviceRequestId}`) === true;
}

interface ParsedNotes {
  preparedBy?: string;
  willingness: PatientWillingness;
  barriers: string[];
  outreachEntries: { date: string; text: string }[];
  declineReason?: string;
  signedBy?: string;
  signedAt?: string;
}

function parseNotes(notes: fhir4.Annotation[] | undefined): ParsedNotes {
  const result: ParsedNotes = { willingness: "unknown", barriers: [], outreachEntries: [] };
  for (const note of notes ?? []) {
    const text = note.text ?? "";
    if (text.startsWith(NOTE_TAG.preparedBy)) {
      result.preparedBy = text.slice(NOTE_TAG.preparedBy.length).trim();
    } else if (text.startsWith(NOTE_TAG.willingness)) {
      const value = text.slice(NOTE_TAG.willingness.length).trim().toLowerCase();
      if (value === "interested" || value === "declined") result.willingness = value;
    } else if (text.startsWith(NOTE_TAG.barrier)) {
      result.barriers.push(text.slice(NOTE_TAG.barrier.length).trim());
    } else if (text.startsWith(NOTE_TAG.outreach)) {
      result.outreachEntries.push({ date: note.time ?? "", text: text.slice(NOTE_TAG.outreach.length).trim() });
    } else if (text.startsWith(NOTE_TAG.declineReason)) {
      result.declineReason = text.slice(NOTE_TAG.declineReason.length).trim();
    } else if (text.startsWith(NOTE_TAG.signed)) {
      result.signedBy = text.slice(NOTE_TAG.signed.length).trim();
      result.signedAt = note.time;
    }
  }
  return result;
}

function deriveStatus(
  serviceRequest: fhir4.ServiceRequest,
  reviewTask: fhir4.Task | undefined,
  coordinationTask: fhir4.Task | undefined,
  parsed: ParsedNotes,
): MntReferralStatus {
  if (serviceRequest.status === "revoked" || serviceRequest.status === "entered-in-error") return "declined";

  if (serviceRequest.status === "draft") {
    if (reviewTask && (reviewTask.status === "requested" || reviewTask.status === "ready" || reviewTask.status === "in-progress")) {
      return "awaiting-clinician-signature";
    }
    return "draft-prepared";
  }

  // status active or completed from here.
  const lastOutreach = parsed.outreachEntries[parsed.outreachEntries.length - 1];
  if (lastOutreach && lastOutreach.text.toLowerCase().includes("no response") && !serviceRequest.occurrenceDateTime) {
    return "unable-to-reach-patient";
  }

  if (coordinationTask?.status === "completed" || serviceRequest.status === "completed") return "completed";
  if (serviceRequest.occurrenceDateTime) return "appointment-scheduled";
  if (coordinationTask?.status === "in-progress") return "scheduling-in-progress";

  return "active-referral";
}

function nextResponsibleFor(status: MntReferralStatus): NextResponsible {
  switch (status) {
    case "not-assessed":
    case "referral-suggested":
      return "nurse";
    case "draft-prepared":
      return "nurse";
    case "awaiting-clinician-signature":
      return "clinician";
    case "active-referral":
    case "scheduling-in-progress":
    case "unable-to-reach-patient":
      return "nurse";
    case "appointment-scheduled":
      return "dietitian";
    case "completed":
    case "declined":
      return "none";
    default:
      return "none";
  }
}

function buildReferralView(
  serviceRequest: fhir4.ServiceRequest,
  reviewTask: fhir4.Task | undefined,
  coordinationTask: fhir4.Task | undefined,
): MntReferralView {
  const parsed = parseNotes(serviceRequest.note);
  const status = deriveStatus(serviceRequest, reviewTask, coordinationTask, parsed);

  return {
    serviceRequestId: serviceRequest.id!,
    patientId: serviceRequest.subject.reference?.split("/").pop() ?? "",
    status,
    reasonText: serviceRequest.reasonReference?.[0]?.display,
    referringClinician: serviceRequest.status === "draft" ? reviewTask?.owner?.display : serviceRequest.requester?.display,
    signingClinician: parsed.signedBy,
    dietitian: serviceRequest.performer?.[0]?.display,
    datePrepared: serviceRequest.authoredOn,
    dateSigned: parsed.signedAt,
    appointmentDate: serviceRequest.occurrenceDateTime,
    lastOutreach: parsed.outreachEntries[parsed.outreachEntries.length - 1]?.date,
    patientWillingness: parsed.willingness,
    accessBarriers: parsed.barriers,
    declineReason: parsed.declineReason,
    nextResponsible: nextResponsibleFor(status),
    reviewTaskStatus: reviewTask?.status,
    coordinationTaskStatus: coordinationTask?.status,
    canSign: status === "awaiting-clinician-signature" || status === "draft-prepared",
  };
}

interface PatientMntResources {
  serviceRequests: fhir4.ServiceRequest[];
  tasks: fhir4.Task[];
}

async function fetchPatientMntResources(patientId: string): Promise<PatientMntResources> {
  const [serviceRequestResult, taskResult] = await Promise.all([
    searchFhirResource<fhir4.Bundle>("ServiceRequest", `patient=${encodeURIComponent(patientId)}`),
    searchFhirResource<fhir4.Bundle>("Task", `patient=${encodeURIComponent(patientId)}`),
  ]);

  const serviceRequests = (serviceRequestResult.body?.entry ?? [])
    .map(entry => entry.resource)
    .filter((r): r is fhir4.ServiceRequest => !!r && r.resourceType === "ServiceRequest" && isMntServiceRequest(r as fhir4.ServiceRequest));

  const tasks = (taskResult.body?.entry ?? [])
    .map(entry => entry.resource)
    .filter((r): r is fhir4.Task => !!r && r.resourceType === "Task");

  return { serviceRequests, tasks };
}

function latestServiceRequest(serviceRequests: fhir4.ServiceRequest[]): fhir4.ServiceRequest | undefined {
  return [...serviceRequests].sort((a, b) => (a.authoredOn ?? "").localeCompare(b.authoredOn ?? "")).pop();
}

function evaluateSuggestion(conditions: fhir4.Condition[], observations: fhir4.Observation[]): MntSuggestion {
  const matchedReasons: string[] = [];

  const hasRenalDiagnosis = conditions.some(isRenalDiagnosisCondition);
  if (hasRenalDiagnosis) matchedReasons.push(MNT_SUGGESTION_RULE_LABELS.renalDiagnosis);

  const systolic = getLatestObservation(filterObservationsByLoinc(observations, LOINC_CODES.systolicBloodPressure));
  const bpConcern =
    (systolic?.valueQuantity?.value ?? 0) > BP_CONCERN_SYSTOLIC_THRESHOLD ||
    (getObservationInterpretation(systolic as fhir4.Observation) ?? "").toLowerCase().includes("high");
  if (bpConcern) matchedReasons.push(MNT_SUGGESTION_RULE_LABELS.bloodPressureConcern);

  const potassium = getLatestObservation(filterObservationsByLoinc(observations, LOINC_POTASSIUM));
  const phosphorus = getLatestObservation(filterObservationsByLoinc(observations, LOINC_PHOSPHORUS));
  const abnormalElectrolyte = [potassium, phosphorus].some(observation => {
    const interpretation = observation ? getObservationInterpretation(observation) : undefined;
    return interpretation ? /high|low|abnormal/i.test(interpretation) : false;
  });
  if (abnormalElectrolyte) matchedReasons.push(MNT_SUGGESTION_RULE_LABELS.abnormalPotassiumOrPhosphorus);

  const conditionTexts = conditions.map(formatConditionText).join(" ").toLowerCase();
  if (EDEMA_OR_WEIGHT_CHANGE_KEYWORDS.some(keyword => conditionTexts.includes(keyword))) {
    matchedReasons.push(MNT_SUGGESTION_RULE_LABELS.edemaOrWeightChange);
  }
  if (POOR_INTAKE_KEYWORDS.some(keyword => conditionTexts.includes(keyword))) {
    matchedReasons.push(MNT_SUGGESTION_RULE_LABELS.poorIntake);
  }
  if (PATIENT_CONFUSION_KEYWORDS.some(keyword => conditionTexts.includes(keyword))) {
    matchedReasons.push(MNT_SUGGESTION_RULE_LABELS.patientConfusion);
  }
  if (FOOD_INSECURITY_KEYWORDS.some(keyword => conditionTexts.includes(keyword))) {
    matchedReasons.push(MNT_SUGGESTION_RULE_LABELS.foodInsecurity);
  }
  if (ADHERENCE_BARRIER_KEYWORDS.some(keyword => conditionTexts.includes(keyword))) {
    matchedReasons.push(MNT_SUGGESTION_RULE_LABELS.adherenceBarrier);
  }

  return { suggested: hasRenalDiagnosis && matchedReasons.length > 0, matchedReasons };
}

export async function getPatientMntState(
  patient: fhir4.Patient,
  conditions: fhir4.Condition[],
  observations: fhir4.Observation[],
): Promise<MntPatientState> {
  const patientId = patient.id ?? "";
  const { serviceRequests, tasks } = await fetchPatientMntResources(patientId);
  const serviceRequest = latestServiceRequest(serviceRequests);

  let referral: MntReferralView | null = null;
  if (serviceRequest?.id) {
    const relatedTasks = tasks.filter(task => taskFocusesOn(task, serviceRequest.id!));
    const reviewTask = relatedTasks.find(isReviewTask);
    const coordinationTask = relatedTasks.find(isCoordinationTask);
    referral = buildReferralView(serviceRequest, reviewTask, coordinationTask);
  }

  const suggestion = evaluateSuggestion(conditions, observations);

  return { patientId, patientName: formatPatientName(patient), referral, suggestion };
}

export interface CreateDraftReferralInput {
  patientId: string;
  reasonReference: fhir4.Reference;
  supportingInfo: fhir4.Reference[];
  willingness: PatientWillingness;
  barriers: string[];
  preparedByDisplay: string;
}

export type MntActionResult =
  | { ok: true; referral: MntReferralView }
  | { ok: false; status: number; error: string };

export async function createDraftReferral(input: CreateDraftReferralInput): Promise<MntActionResult> {
  const { serviceRequests } = await fetchPatientMntResources(input.patientId);
  const existingActiveOrDraft = serviceRequests.find(sr => sr.status === "draft" || sr.status === "active");
  if (existingActiveOrDraft) {
    return { ok: false, status: 409, error: "A referral with this identifier already exists." };
  }

  const notes: fhir4.Annotation[] = [
    annotation(`${NOTE_TAG.preparedBy}${input.preparedByDisplay}`),
    annotation(`${NOTE_TAG.willingness}${input.willingness}`),
    ...input.barriers.map(barrier => annotation(`${NOTE_TAG.barrier}${barrier}`)),
  ];

  const serviceRequest: fhir4.ServiceRequest = {
    resourceType: "ServiceRequest",
    status: "draft",
    intent: "proposal",
    subject: { reference: `Patient/${input.patientId}` },
    code: { text: MNT_SERVICE_REQUEST_TEXT },
    reasonReference: [input.reasonReference],
    supportingInfo: input.supportingInfo,
    authoredOn: new Date().toISOString(),
    requester: { display: input.preparedByDisplay },
    note: notes,
  };

  const created = await createFhirResource<fhir4.ServiceRequest | fhir4.OperationOutcome>("ServiceRequest", serviceRequest);
  if (created.status !== 201 || isOperationOutcome(created.body)) {
    return { ok: false, status: created.status, error: "Unable to create the referral on the FHIR server." };
  }

  return { ok: true, referral: buildReferralView(created.body, undefined, undefined) };
}

export interface SendForSignatureInput {
  serviceRequestId: string;
  nurseDisplay: string;
}

/** The nurse's "Send for Signature" action — creates the clinician-review Task for an already-drafted referral. */
export async function sendForSignature(input: SendForSignatureInput): Promise<MntActionResult> {
  const loaded = await loadReferralById(input.serviceRequestId);
  if (!loaded) return { ok: false, status: 404, error: "Referral not found." };
  if (loaded.serviceRequest.status !== "draft") {
    return { ok: false, status: 409, error: "Only a draft referral can be sent for signature." };
  }
  if (loaded.reviewTask) {
    return { ok: false, status: 409, error: "This referral has already been sent for signature." };
  }

  const reviewTask: fhir4.Task = {
    resourceType: "Task",
    status: "requested",
    intent: "order",
    description: REVIEW_TASK_DESCRIPTION,
    priority: "routine",
    focus: { reference: `ServiceRequest/${input.serviceRequestId}` },
    for: loaded.serviceRequest.subject,
    owner: { display: "Clinician review pool" },
    authoredOn: new Date().toISOString(),
  };
  const createdTask = await createFhirResource<fhir4.Task>("Task", reviewTask);

  return { ok: true, referral: buildReferralView(loaded.serviceRequest, createdTask.body, loaded.coordinationTask) };
}

async function loadReferralById(serviceRequestId: string): Promise<{
  serviceRequest: fhir4.ServiceRequest;
  reviewTask?: fhir4.Task;
  coordinationTask?: fhir4.Task;
} | null> {
  const current = await readFhirResource<fhir4.ServiceRequest | fhir4.OperationOutcome>("ServiceRequest", serviceRequestId);
  if (current.status !== 200 || isOperationOutcome(current.body)) return null;

  const patientId = current.body.subject.reference?.split("/").pop() ?? "";
  const taskResult = await searchFhirResource<fhir4.Bundle>("Task", `patient=${encodeURIComponent(patientId)}`);
  const allTasks = (taskResult.body?.entry ?? [])
    .map(entry => entry.resource)
    .filter((r): r is fhir4.Task => !!r && r.resourceType === "Task");
  const tasks = allTasks.filter(task => taskFocusesOn(task, serviceRequestId));

  return {
    serviceRequest: current.body,
    reviewTask: tasks.find(isReviewTask),
    coordinationTask: tasks.find(isCoordinationTask),
  };
}

export interface SignReferralInput {
  serviceRequestId: string;
  clinicianDisplay: string;
  dietitianDisplay?: string;
}

export async function signReferral(input: SignReferralInput): Promise<MntActionResult> {
  const loaded = await loadReferralById(input.serviceRequestId);
  if (!loaded) return { ok: false, status: 404, error: "Referral not found." };
  if (loaded.serviceRequest.status !== "draft") {
    return { ok: false, status: 409, error: "Only a draft referral can be signed." };
  }

  const updated: fhir4.ServiceRequest = {
    ...loaded.serviceRequest,
    status: "active",
    intent: "order",
    requester: { display: input.clinicianDisplay },
    ...(input.dietitianDisplay ? { performer: [{ display: input.dietitianDisplay }] } : {}),
    note: [...(loaded.serviceRequest.note ?? []), annotation(`${NOTE_TAG.signed}${input.clinicianDisplay}`)],
  };

  const result = await updateFhirResource<fhir4.ServiceRequest | fhir4.OperationOutcome>("ServiceRequest", input.serviceRequestId, updated);
  if (isOperationOutcome(result.body)) return { ok: false, status: result.status, error: "Unable to sign the referral." };

  if (loaded.reviewTask?.id) {
    await updateFhirResource<fhir4.Task>("Task", loaded.reviewTask.id, {
      ...loaded.reviewTask,
      status: "completed",
      lastModified: new Date().toISOString(),
    });
  }

  const coordinationTask: fhir4.Task = {
    resourceType: "Task",
    status: "requested",
    intent: "order",
    description: COORDINATION_TASK_DESCRIPTION,
    priority: "routine",
    focus: { reference: `ServiceRequest/${input.serviceRequestId}` },
    for: loaded.serviceRequest.subject,
    owner: { display: "Care coordination (RN)" },
    businessStatus: { text: "Scheduling" },
    authoredOn: new Date().toISOString(),
  };
  const createdTask = await createFhirResource<fhir4.Task>("Task", coordinationTask);

  return {
    ok: true,
    referral: buildReferralView(
      result.body,
      loaded.reviewTask ? { ...loaded.reviewTask, status: "completed" } : undefined,
      createdTask.body,
    ),
  };
}

export interface DeclineReferralInput {
  serviceRequestId: string;
  reason: string;
  clinicianDisplay: string;
}

export async function declineReferral(input: DeclineReferralInput): Promise<MntActionResult> {
  const loaded = await loadReferralById(input.serviceRequestId);
  if (!loaded) return { ok: false, status: 404, error: "Referral not found." };

  const updated: fhir4.ServiceRequest = {
    ...loaded.serviceRequest,
    status: "revoked",
    note: [...(loaded.serviceRequest.note ?? []), annotation(`${NOTE_TAG.declineReason}${input.reason}`, input.clinicianDisplay)],
  };

  const result = await updateFhirResource<fhir4.ServiceRequest | fhir4.OperationOutcome>("ServiceRequest", input.serviceRequestId, updated);
  if (isOperationOutcome(result.body)) return { ok: false, status: result.status, error: "Unable to decline the referral." };

  if (loaded.reviewTask?.id) {
    await updateFhirResource<fhir4.Task>("Task", loaded.reviewTask.id, {
      ...loaded.reviewTask,
      status: "rejected",
      lastModified: new Date().toISOString(),
    });
  }

  return { ok: true, referral: buildReferralView(result.body, loaded.reviewTask ? { ...loaded.reviewTask, status: "rejected" } : undefined, undefined) };
}

export interface ModifyReferralInput {
  serviceRequestId: string;
  reasonText?: string;
  clinicianDisplay: string;
}

export async function modifyReferral(input: ModifyReferralInput): Promise<MntActionResult> {
  const loaded = await loadReferralById(input.serviceRequestId);
  if (!loaded) return { ok: false, status: 404, error: "Referral not found." };
  if (loaded.serviceRequest.status !== "draft") {
    return { ok: false, status: 409, error: "Only a draft referral can be modified." };
  }

  const updated: fhir4.ServiceRequest = {
    ...loaded.serviceRequest,
    ...(input.reasonText ? { reasonReference: [{ display: input.reasonText }] } : {}),
    note: [...(loaded.serviceRequest.note ?? []), annotation(`Modified by ${input.clinicianDisplay}`, input.clinicianDisplay)],
  };

  const result = await updateFhirResource<fhir4.ServiceRequest | fhir4.OperationOutcome>("ServiceRequest", input.serviceRequestId, updated);
  if (isOperationOutcome(result.body)) return { ok: false, status: result.status, error: "Unable to modify the referral." };

  return { ok: true, referral: buildReferralView(result.body, loaded.reviewTask, loaded.coordinationTask) };
}

export interface DocumentBarrierInput {
  serviceRequestId: string;
  barrier: string;
  nurseDisplay: string;
}

export async function documentBarrier(input: DocumentBarrierInput): Promise<MntActionResult> {
  const loaded = await loadReferralById(input.serviceRequestId);
  if (!loaded) return { ok: false, status: 404, error: "Referral not found." };

  const updated: fhir4.ServiceRequest = {
    ...loaded.serviceRequest,
    note: [...(loaded.serviceRequest.note ?? []), annotation(`${NOTE_TAG.barrier}${input.barrier}`, input.nurseDisplay)],
  };

  const result = await updateFhirResource<fhir4.ServiceRequest | fhir4.OperationOutcome>("ServiceRequest", input.serviceRequestId, updated);
  if (isOperationOutcome(result.body)) return { ok: false, status: result.status, error: "Unable to document the barrier." };

  return { ok: true, referral: buildReferralView(result.body, loaded.reviewTask, loaded.coordinationTask) };
}

export interface ContactPatientInput {
  serviceRequestId: string;
  outcome: "reached" | "no-response" | "declined-appointment";
  note?: string;
  nurseDisplay: string;
}

export async function contactPatient(input: ContactPatientInput): Promise<MntActionResult> {
  const loaded = await loadReferralById(input.serviceRequestId);
  if (!loaded) return { ok: false, status: 404, error: "Referral not found." };

  const outcomeText = input.outcome === "reached" ? "Reached patient" : input.outcome === "no-response" ? "No response" : "Patient declined appointment";
  const text = input.note ? `${outcomeText}: ${input.note}` : outcomeText;

  const updated: fhir4.ServiceRequest = {
    ...loaded.serviceRequest,
    note: [...(loaded.serviceRequest.note ?? []), annotation(`${NOTE_TAG.outreach}${text}`, input.nurseDisplay)],
  };

  const result = await updateFhirResource<fhir4.ServiceRequest | fhir4.OperationOutcome>("ServiceRequest", input.serviceRequestId, updated);
  if (isOperationOutcome(result.body)) return { ok: false, status: result.status, error: "Unable to record outreach." };

  return { ok: true, referral: buildReferralView(result.body, loaded.reviewTask, loaded.coordinationTask) };
}

export interface CoordinateSchedulingInput {
  serviceRequestId: string;
  appointmentDate?: string;
  dietitianDisplay?: string;
  nurseDisplay: string;
}

export async function coordinateScheduling(input: CoordinateSchedulingInput): Promise<MntActionResult> {
  const loaded = await loadReferralById(input.serviceRequestId);
  if (!loaded) return { ok: false, status: 404, error: "Referral not found." };

  const updated: fhir4.ServiceRequest = {
    ...loaded.serviceRequest,
    ...(input.appointmentDate ? { occurrenceDateTime: input.appointmentDate } : {}),
    ...(input.dietitianDisplay ? { performer: [{ display: input.dietitianDisplay }] } : {}),
  };

  const result = await updateFhirResource<fhir4.ServiceRequest | fhir4.OperationOutcome>("ServiceRequest", input.serviceRequestId, updated);
  if (isOperationOutcome(result.body)) return { ok: false, status: result.status, error: "Unable to update scheduling." };

  let updatedCoordinationTask = loaded.coordinationTask;
  if (loaded.coordinationTask?.id) {
    const nextStatus: fhir4.Task["status"] = input.appointmentDate ? "completed" : "in-progress";
    const taskUpdate: fhir4.Task = {
      ...loaded.coordinationTask,
      status: nextStatus,
      businessStatus: { text: input.appointmentDate ? "Appointment scheduled" : "Scheduling in progress" },
      lastModified: new Date().toISOString(),
    };
    await updateFhirResource<fhir4.Task>("Task", loaded.coordinationTask.id, taskUpdate);
    updatedCoordinationTask = taskUpdate;
  }

  return { ok: true, referral: buildReferralView(result.body, loaded.reviewTask, updatedCoordinationTask) };
}

// ---------------------------------------------------------------------------
// Population-wide nurse worklist
// ---------------------------------------------------------------------------

function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / (24 * 60 * 60 * 1000));
}

function nextActionFor(status: MntReferralStatus): string {
  switch (status) {
    case "referral-suggested":
      return "Prepare referral";
    case "draft-prepared":
      return "Send for signature";
    case "awaiting-clinician-signature":
      return "Awaiting clinician signature";
    case "active-referral":
      return "Coordinate scheduling";
    case "scheduling-in-progress":
      return "Confirm appointment";
    case "unable-to-reach-patient":
      return "Contact patient";
    case "appointment-scheduled":
      return "Awaiting visit";
    case "completed":
      return "None";
    case "declined":
      return "None";
    default:
      return "Assess nutrition needs";
  }
}

export async function buildNurseMntWorklist(): Promise<MntWorklistResponse> {
  const [patientsResult, conditionsResult, observationsResult, serviceRequestsResult, tasksResult] = await Promise.all([
    fetchAllPages<fhir4.Patient>("Patient", "_count=100"),
    fetchAllPages<fhir4.Condition>("Condition", "_count=100"),
    fetchAllPages<fhir4.Observation>("Observation", "_count=100"),
    fetchAllPages<fhir4.ServiceRequest>("ServiceRequest", "_count=100"),
    fetchAllPages<fhir4.Task>("Task", "_count=100"),
  ]);

  const mntServiceRequests = serviceRequestsResult.resources.filter(isMntServiceRequest);

  const queue: MntQueueItem[] = [];
  const summary: MntPopulationSummary = {
    awaitingSignature: 0,
    approvedAwaitingScheduling: 0,
    notContacted: 0,
    appointmentsScheduled: 0,
    completed: 0,
    blockedByBarriers: 0,
  };

  for (const patient of patientsResult.resources) {
    const patientId = patient.id ?? "";
    const patientServiceRequests = mntServiceRequests.filter(sr => referencesPatient(sr.subject, patientId));
    const serviceRequest = latestServiceRequest(patientServiceRequests);
    if (!serviceRequest?.id) continue;

    const relatedTasks = tasksResult.resources.filter(task => taskFocusesOn(task, serviceRequest.id!));
    const reviewTask = relatedTasks.find(isReviewTask);
    const coordinationTask = relatedTasks.find(isCoordinationTask);
    const view = buildReferralView(serviceRequest, reviewTask, coordinationTask);

    if (view.status === "awaiting-clinician-signature") summary.awaitingSignature++;
    if (view.status === "active-referral" || view.status === "scheduling-in-progress") summary.approvedAwaitingScheduling++;
    if (view.status === "unable-to-reach-patient" || (!view.lastOutreach && view.status !== "completed" && view.status !== "declined" && view.status !== "draft-prepared" && view.status !== "awaiting-clinician-signature")) {
      summary.notContacted++;
    }
    if (view.status === "appointment-scheduled") summary.appointmentsScheduled++;
    if (view.status === "completed") summary.completed++;
    if (view.accessBarriers.length > 0 && view.status !== "completed") summary.blockedByBarriers++;

    if (view.status !== "completed" && view.status !== "declined") {
      queue.push({
        patientId,
        patientName: formatPatientName(patient),
        reasonText: view.reasonText,
        status: view.status,
        ownerLabel: view.nextResponsible === "clinician" ? "Clinician" : view.nextResponsible === "dietitian" ? "Dietitian" : "RN Care Coordinator",
        daysWaiting: view.datePrepared ? daysBetween(view.datePrepared, new Date().toISOString()) : undefined,
        nextAction: nextActionFor(view.status),
      });
    }
  }

  queue.sort((a, b) => (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0));

  return { summary, queue, generatedAt: new Date().toISOString() };
}
