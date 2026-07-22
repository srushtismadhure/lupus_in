import { formatConditionText, formatMedicationText, formatObservationName, formatPatientName, isLupusNephritisCondition } from "../formatters.js";
import { SLE_SYSTEMS_REVIEW_QUESTIONNAIRE_URL } from "../terminology/sle-systems-review-codes.js";
import { SLE_SYSTEM_DEFINITIONS } from "./system-definitions.js";
import type {
  SleEvidenceItem,
  SleOutstandingReviewItem,
  SlePendingNoteConcept,
  SleSystemDefinition,
  SleSystemId,
  SleSystemReview,
  SleSystemsRawData,
  SleSystemsReviewModel,
} from "./types.js";

interface EvidenceCandidate extends SleEvidenceItem {
  searchText: string;
  activitySignal: "active-condition" | "possible" | "none";
  overdue: boolean;
}

const OPEN_TASK_STATUSES = new Set(["draft", "requested", "received", "accepted", "ready", "in-progress", "on-hold"]);
const HISTORICAL_CONDITION_STATUSES = new Set(["inactive", "remission", "resolved"]);
const PERMANENT_DAMAGE_TERMS = ["permanent damage", "irreversible damage", "chronic organ damage", "documented organ damage"];

function codeText(code: fhir4.CodeableConcept | undefined): string {
  return [code?.text, ...(code?.coding ?? []).flatMap(coding => [coding.display, coding.code])].filter(Boolean).join(" ");
}

function annotationText(notes: fhir4.Annotation[] | undefined): string {
  return (notes ?? []).map(note => note.text).filter(Boolean).join(" ");
}

function observationValue(observation: fhir4.Observation): string | undefined {
  if (observation.valueQuantity?.value !== undefined) return `${observation.valueQuantity.value}${observation.valueQuantity.unit ? ` ${observation.valueQuantity.unit}` : ""}`;
  if (observation.valueString) return observation.valueString;
  if (observation.valueCodeableConcept) return codeText(observation.valueCodeableConcept);
  if (observation.valueBoolean !== undefined) return observation.valueBoolean ? "Yes" : "No";
  if (observation.valueInteger !== undefined) return `${observation.valueInteger}`;
  return undefined;
}

function conditionStatus(condition: fhir4.Condition): string | undefined {
  return condition.clinicalStatus?.coding?.[0]?.code;
}

function conditionDate(condition: fhir4.Condition): string | undefined {
  return condition.recordedDate ?? condition.onsetDateTime ?? condition.onsetPeriod?.start ?? condition.abatementDateTime;
}

function evidenceId(resourceType: string, id: string | undefined, suffix = ""): string {
  return `${resourceType}-${id ?? crypto.randomUUID()}${suffix}`;
}

function allCandidates(raw: SleSystemsRawData, now: Date): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];

  for (const condition of raw.conditions) {
    const title = formatConditionText(condition);
    const status = conditionStatus(condition);
    const temporalState = status && HISTORICAL_CONDITION_STATUSES.has(status) ? "historical" : "current";
    candidates.push({
      id: evidenceId("Condition", condition.id),
      resourceType: "Condition",
      resourceReference: condition.id ? `Condition/${condition.id}` : undefined,
      title,
      detail: [status ? `Clinical status: ${status}` : undefined, condition.verificationStatus?.coding?.[0]?.display].filter(Boolean).join("; ") || undefined,
      date: conditionDate(condition),
      source: "FHIR Condition",
      temporalState,
      evidenceRole: "condition",
      searchText: `${title} ${codeText(condition.code)} ${annotationText(condition.note)}`.toLowerCase(),
      activitySignal: temporalState === "current" ? "active-condition" : "none",
      overdue: false,
    });
  }

  for (const observation of raw.observations) {
    const title = formatObservationName(observation);
    const value = observationValue(observation);
    const interpretations = (observation.interpretation ?? []).map(codeText).filter(Boolean).join(", ");
    candidates.push({
      id: evidenceId("Observation", observation.id),
      resourceType: "Observation",
      resourceReference: observation.id ? `Observation/${observation.id}` : undefined,
      title: value ? `${title}: ${value}` : title,
      detail: [observation.status !== "final" ? `Status: ${observation.status}` : undefined, interpretations ? `Interpretation: ${interpretations}` : undefined].filter(Boolean).join("; ") || undefined,
      date: observation.effectiveDateTime ?? observation.effectivePeriod?.start ?? observation.issued,
      source: "FHIR Observation",
      temporalState: "current",
      evidenceRole: "monitoring",
      searchText: `${title} ${codeText(observation.code)} ${interpretations} ${annotationText(observation.note)}`.toLowerCase(),
      activitySignal: "none",
      overdue: false,
    });
  }

  for (const medication of raw.medicationRequests) {
    const title = formatMedicationText(medication);
    const active = ["active", "on-hold", "draft", "unknown"].includes(medication.status);
    candidates.push({
      id: evidenceId("MedicationRequest", medication.id),
      resourceType: "MedicationRequest",
      resourceReference: medication.id ? `MedicationRequest/${medication.id}` : undefined,
      title,
      detail: `MedicationRequest status: ${medication.status}`,
      date: medication.authoredOn,
      source: "FHIR MedicationRequest",
      temporalState: active ? "current" : "historical",
      evidenceRole: "treatment",
      searchText: `${title} ${(medication.reasonCode ?? []).map(codeText).join(" ")} ${annotationText(medication.note)}`.toLowerCase(),
      activitySignal: "none",
      overdue: false,
    });
  }

  for (const medication of raw.medicationStatements) {
    const title = codeText(medication.medicationCodeableConcept) || medication.medicationReference?.display || "Medication statement";
    candidates.push({
      id: evidenceId("MedicationStatement", medication.id),
      resourceType: "MedicationStatement",
      resourceReference: medication.id ? `MedicationStatement/${medication.id}` : undefined,
      title,
      detail: `MedicationStatement status: ${medication.status}`,
      date: medication.dateAsserted ?? medication.effectiveDateTime ?? medication.effectivePeriod?.start,
      source: "FHIR MedicationStatement",
      temporalState: medication.status === "active" || medication.status === "intended" ? "current" : "historical",
      evidenceRole: "treatment",
      searchText: `${title} ${(medication.reasonCode ?? []).map(codeText).join(" ")} ${annotationText(medication.note)}`.toLowerCase(),
      activitySignal: "none",
      overdue: false,
    });
  }

  for (const procedure of raw.procedures) {
    const title = codeText(procedure.code) || "Procedure";
    candidates.push({
      id: evidenceId("Procedure", procedure.id),
      resourceType: "Procedure",
      resourceReference: procedure.id ? `Procedure/${procedure.id}` : undefined,
      title,
      detail: `Procedure status: ${procedure.status}`,
      date: procedure.performedDateTime ?? procedure.performedPeriod?.start,
      source: "FHIR Procedure",
      temporalState: "historical",
      evidenceRole: "treatment",
      searchText: `${title} ${codeText(procedure.code)} ${(procedure.reasonCode ?? []).map(codeText).join(" ")} ${annotationText(procedure.note)}`.toLowerCase(),
      activitySignal: "none",
      overdue: false,
    });
  }

  for (const report of raw.diagnosticReports) {
    const title = codeText(report.code) || "Diagnostic report";
    candidates.push({
      id: evidenceId("DiagnosticReport", report.id),
      resourceType: "DiagnosticReport",
      resourceReference: report.id ? `DiagnosticReport/${report.id}` : undefined,
      title,
      detail: report.conclusion,
      date: report.effectiveDateTime ?? report.effectivePeriod?.start ?? report.issued,
      source: "FHIR DiagnosticReport",
      temporalState: "current",
      evidenceRole: "monitoring",
      searchText: `${title} ${codeText(report.code)} ${report.conclusion ?? ""}`.toLowerCase(),
      activitySignal: "none",
      overdue: false,
    });
  }

  for (const document of raw.documentReferences) {
    const title = document.content?.[0]?.attachment?.title ?? document.description ?? (codeText(document.type) || "Clinical document");
    candidates.push({
      id: evidenceId("DocumentReference", document.id),
      resourceType: "DocumentReference",
      resourceReference: document.id ? `DocumentReference/${document.id}` : undefined,
      title,
      detail: document.description,
      date: document.date ?? document.content?.[0]?.attachment?.creation,
      source: "FHIR DocumentReference",
      temporalState: "historical",
      evidenceRole: "note",
      searchText: `${title} ${document.description ?? ""} ${codeText(document.type)}`.toLowerCase(),
      activitySignal: "none",
      overdue: false,
    });
  }

  for (const composition of raw.compositions) {
    const sectionTitles = (composition.section ?? []).map(section => section.title).filter(Boolean).join(" ");
    candidates.push({
      id: evidenceId("Composition", composition.id),
      resourceType: "Composition",
      resourceReference: composition.id ? `Composition/${composition.id}` : undefined,
      title: composition.title,
      detail: sectionTitles || undefined,
      date: composition.date,
      source: "FHIR Composition",
      temporalState: "historical",
      evidenceRole: "note",
      searchText: `${composition.title} ${sectionTitles} ${codeText(composition.type)}`.toLowerCase(),
      activitySignal: "none",
      overdue: false,
    });
  }

  for (const task of raw.tasks) {
    const title = task.description ?? (codeText(task.code) || "Clinical Task");
    const due = task.restriction?.period?.end;
    const overdue = Boolean(due && OPEN_TASK_STATUSES.has(task.status) && Date.parse(due) < now.getTime());
    candidates.push({
      id: evidenceId("Task", task.id),
      resourceType: "Task",
      resourceReference: task.id ? `Task/${task.id}` : undefined,
      title,
      detail: [`Status: ${task.status}`, task.owner?.display ? `Owner: ${task.owner.display}` : undefined, due ? `Due: ${due}` : undefined, overdue ? "Overdue" : undefined].filter(Boolean).join("; "),
      date: task.meta?.lastUpdated ?? task.authoredOn,
      source: "FHIR Task",
      temporalState: OPEN_TASK_STATUSES.has(task.status) ? "current" : "historical",
      evidenceRole: "workflow",
      searchText: `${title} ${codeText(task.code)} ${annotationText(task.note)}`.toLowerCase(),
      activitySignal: "none",
      overdue,
    });
  }

  for (const request of raw.serviceRequests) {
    const title = codeText(request.code) || "Service request";
    candidates.push({
      id: evidenceId("ServiceRequest", request.id),
      resourceType: "ServiceRequest",
      resourceReference: request.id ? `ServiceRequest/${request.id}` : undefined,
      title,
      detail: `ServiceRequest status: ${request.status}`,
      date: request.authoredOn ?? request.occurrenceDateTime ?? request.occurrencePeriod?.start,
      source: "FHIR ServiceRequest",
      temporalState: ["active", "draft", "on-hold", "unknown"].includes(request.status) ? "current" : "historical",
      evidenceRole: "workflow",
      searchText: `${title} ${codeText(request.code)} ${(request.reasonCode ?? []).map(codeText).join(" ")} ${annotationText(request.note)}`.toLowerCase(),
      activitySignal: "none",
      overdue: false,
    });
  }

  for (const adverseEvent of raw.adverseEvents) {
    const title = codeText(adverseEvent.event) || "Adverse event";
    candidates.push({
      id: evidenceId("AdverseEvent", adverseEvent.id),
      resourceType: "AdverseEvent",
      resourceReference: adverseEvent.id ? `AdverseEvent/${adverseEvent.id}` : undefined,
      title,
      detail: `AdverseEvent status: ${adverseEvent.actuality}`,
      date: adverseEvent.date ?? adverseEvent.recordedDate,
      source: "FHIR AdverseEvent",
      temporalState: "historical",
      evidenceRole: "treatment",
      searchText: `${title} ${codeText(adverseEvent.event)}`.toLowerCase(),
      activitySignal: "none",
      overdue: false,
    });
  }

  return candidates;
}

function includesKeyword(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword.toLowerCase()));
}

function reviewedItems(raw: SleSystemsRawData): Set<string> {
  const reviewed = new Set<string>();
  for (const response of raw.questionnaireResponses) {
    if (!response.questionnaire?.startsWith(SLE_SYSTEMS_REVIEW_QUESTIONNAIRE_URL)) continue;
    for (const item of response.item ?? []) {
      if (item.answer?.some(answer => answer.valueBoolean === true)) reviewed.add(item.linkId);
    }
  }
  return reviewed;
}

function pendingNoteConcepts(raw: SleSystemsRawData): SlePendingNoteConcept[] {
  const concepts: SlePendingNoteConcept[] = [];
  for (const draft of raw.clinicalNoteDrafts) {
    for (const concept of draft.concepts) {
      if (concept.clinicianDecision || concept.status !== "present" || concept.subject !== "patient") continue;
      const searchText = `${concept.normalizedConcept} ${concept.sourceText}`.toLowerCase();
      const system = SLE_SYSTEM_DEFINITIONS.find(candidate => includesKeyword(searchText, candidate.evidenceKeywords));
      if (!system) continue;
      concepts.push({
        id: `${draft.draftId}-${concept.id}`,
        draftId: draft.draftId,
        conceptId: concept.id,
        systemId: system.id,
        label: concept.normalizedConcept,
        sourceText: concept.sourceText,
        noteDate: draft.noteDate,
        certainty: concept.certainty,
        validatedCandidateId: concept.terminologyCandidates.find(candidate => candidate.validationStatus === "validated")?.id,
        draftReference: draft.fhirReference,
      });
    }
  }
  return concepts.sort((a, b) => b.noteDate.localeCompare(a.noteDate));
}

function sortEvidence(items: EvidenceCandidate[]): EvidenceCandidate[] {
  return [...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.title.localeCompare(b.title));
}

function systemStatus(
  system: SleSystemDefinition,
  evidence: EvidenceCandidate[],
  notes: SlePendingNoteConcept[],
  reviewedCount: number,
  totalCount: number,
): Pick<SleSystemReview, "status" | "statusLabel" | "statusDetail"> {
  if (notes.length > 0) {
    return {
      status: "possible-activity",
      statusLabel: "Possible activity",
      statusDetail: "A Notes & Coding concept is awaiting clinician confirmation. It is not yet treated as a confirmed finding.",
    };
  }
  if (evidence.some(item => item.activitySignal === "active-condition")) {
    return {
      status: "current-activity",
      statusLabel: "Current documented activity",
      statusDetail: `An active ${system.title.toLowerCase()} Condition is documented. This review does not calculate disease severity.`,
    };
  }
  if (evidence.some(item => item.overdue)) {
    return {
      status: "monitoring-due",
      statusLabel: "Monitoring due",
      statusDetail: "An open, overdue Task is linked to this system and needs workflow review.",
    };
  }
  if (evidence.some(item => item.temporalState === "historical" && ["condition", "treatment", "note"].includes(item.evidenceRole))) {
    return {
      status: "historical-involvement",
      statusLabel: "Historical involvement",
      statusDetail: "Historical evidence is available; current activity cannot be inferred from history alone.",
    };
  }
  if (reviewedCount === totalCount && evidence.length === 0) {
    return {
      status: "no-current-evidence",
      statusLabel: "Assessment complete; no current concern documented",
      statusDetail: "The structured review is complete and no system-specific FHIR evidence is currently available.",
    };
  }
  if (evidence.length > 0 || reviewedCount > 0) {
    return {
      status: "assessment-incomplete",
      statusLabel: "Assessment incomplete",
      statusDetail: "Some evidence is available, but the structured clinician review is not complete.",
    };
  }
  return {
    status: "unable-to-determine",
    statusLabel: "Unable to determine",
    statusDetail: "No system-specific evidence or completed structured assessment is available.",
  };
}

function buildSystem(
  definition: SleSystemDefinition,
  candidates: EvidenceCandidate[],
  reviewed: Set<string>,
  notes: SlePendingNoteConcept[],
): SleSystemReview {
  const evidence = sortEvidence(candidates.filter(candidate => includesKeyword(candidate.searchText, definition.evidenceKeywords)));
  const noteConcepts = notes.filter(note => note.systemId === definition.id);
  const checklist = definition.checklist.map(item => {
    const linkId = `${definition.id}.${item.id}`;
    const matching = evidence.filter(candidate => includesKeyword(candidate.searchText, item.evidenceKeywords));
    return {
      id: item.id,
      label: item.label,
      state: reviewed.has(linkId) ? "reviewed" as const : matching.length > 0 ? "documented" as const : "missing" as const,
      evidenceReferences: matching.flatMap(candidate => candidate.resourceReference ? [candidate.resourceReference] : []),
    };
  });
  const reviewedCount = checklist.filter(item => item.state === "reviewed").length;
  const documentedCount = checklist.filter(item => item.state !== "missing").length;
  const totalCount = checklist.length;
  const overdue = evidence.some(item => item.overdue);
  const completeness = reviewedCount === totalCount
    ? "complete"
    : overdue
      ? "monitoring-overdue"
      : reviewedCount > 0
        ? "partial"
        : evidence.length > 0
          ? "incomplete"
          : "not-assessed";
  const status = systemStatus(definition, evidence, noteConcepts, reviewedCount, totalCount);
  const dates = [...evidence.map(item => item.date), ...noteConcepts.map(item => item.noteDate)].filter((date): date is string => Boolean(date)).sort();
  const currentEvidence = evidence.filter(item => item.temporalState !== "historical");
  const historicalEvidence = evidence.filter(item => item.temporalState === "historical");
  const outstandingTasks = currentEvidence.filter(item => item.resourceType === "Task");
  const nextActions: string[] = [];
  if (noteConcepts.length > 0) nextActions.push("Review pending Notes & Coding concepts");
  if (checklist.some(item => item.state !== "reviewed")) nextActions.push("Complete selected assessment items");
  if (outstandingTasks.some(item => item.overdue)) nextActions.push("Review overdue Task ownership and due date");
  if (historicalEvidence.length > 0) nextActions.push("Review longitudinal evidence");
  if (nextActions.length === 0) nextActions.push("Continue the documented monitoring plan");

  return {
    id: definition.id,
    title: definition.title,
    shortLabel: definition.shortLabel,
    description: definition.description,
    bodyRegions: definition.bodyRegions,
    ...status,
    completeness,
    completenessLabel: `${reviewedCount} of ${totalCount} assessment items reviewed`,
    evidenceCompletionLabel: `${documentedCount} of ${totalCount} evidence elements documented`,
    reviewedCount,
    documentedCount,
    totalCount,
    lastUpdated: dates.at(-1),
    permanentDamageDocumented: evidence.some(item => includesKeyword(item.searchText, PERMANENT_DAMAGE_TERMS)),
    currentEvidence,
    historicalEvidence,
    checklist,
    outstandingTasks,
    pendingNoteConcepts: noteConcepts,
    nextActions,
  };
}

export function buildSleSystemsReviewModel(raw: SleSystemsRawData, now = new Date()): SleSystemsReviewModel {
  const candidates = allCandidates(raw, now);
  const reviewed = reviewedItems(raw);
  const notes = pendingNoteConcepts(raw);
  const systems = SLE_SYSTEM_DEFINITIONS.map(definition => buildSystem(definition, candidates, reviewed, notes));
  const reviewedTotal = systems.reduce((sum, system) => sum + system.reviewedCount, 0);
  const documentedTotal = systems.reduce((sum, system) => sum + system.documentedCount, 0);
  const itemTotal = systems.reduce((sum, system) => sum + system.totalCount, 0);
  const outstandingReview: SleOutstandingReviewItem[] = [];
  for (const system of systems) {
    if (system.pendingNoteConcepts.length > 0) {
      outstandingReview.push({ id: `${system.id}-notes`, systemId: system.id, systemTitle: system.title, label: `${system.pendingNoteConcepts.length} note concept${system.pendingNoteConcepts.length === 1 ? "" : "s"} awaiting review`, reason: "note-review" });
    }
    if (system.outstandingTasks.some(task => task.detail?.includes("Overdue"))) {
      outstandingReview.push({ id: `${system.id}-overdue`, systemId: system.id, systemTitle: system.title, label: "Open Task is overdue", reason: "monitoring-overdue" });
    }
    const unreviewed = system.totalCount - system.reviewedCount;
    if (unreviewed > 0) {
      outstandingReview.push({ id: `${system.id}-assessment`, systemId: system.id, systemTitle: system.title, label: `${unreviewed} assessment item${unreviewed === 1 ? "" : "s"} not reviewed`, reason: system.documentedCount > 0 ? "assessment-incomplete" : "missing-evidence" });
    }
  }

  const primaryDiagnosis = raw.conditions.find(isLupusNephritisCondition) ?? raw.conditions.find(condition => formatConditionText(condition).toLowerCase().includes("lupus"));
  return {
    patient: {
      id: raw.patient.id ?? "",
      name: formatPatientName(raw.patient),
      identifier: raw.patient.identifier?.[0]?.value,
      primaryDiagnosis: primaryDiagnosis ? formatConditionText(primaryDiagnosis) : undefined,
    },
    title: "Structured SLE Systems Review",
    generatedAt: now.toISOString(),
    systems,
    summary: {
      currentActivity: systems.filter(system => system.status === "current-activity").length,
      possibleActivity: systems.filter(system => system.status === "possible-activity").length,
      historicalInvolvement: systems.filter(system => system.status === "historical-involvement" || system.historicalEvidence.length > 0).length,
      assessmentIncomplete: systems.filter(system => system.reviewedCount < system.totalCount).length,
      monitoringDue: systems.filter(system => system.outstandingTasks.some(task => task.detail?.includes("Overdue"))).length,
      unableToDetermine: systems.filter(system => system.status === "unable-to-determine").length,
    },
    assessment: {
      reviewed: reviewedTotal,
      documented: documentedTotal,
      total: itemTotal,
      label: `${reviewedTotal} of ${itemTotal} structured assessment items reviewed`,
    },
    outstandingReview,
    dataStatus: { complete: raw.failedSections.length === 0, failedSections: raw.failedSections },
  };
}
