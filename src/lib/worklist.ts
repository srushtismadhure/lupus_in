import { fetchAllPages } from "./fhir-server-client.js";
import {
  LOINC_CODES,
  filterObservationsByLoinc,
  getLatestObservation,
  getObservationQuantityValue,
  sortObservationsByDate,
} from "./fhir-observations.js";
import { formatConditionText, formatPatientName, isLupusNephritisCondition, referencesPatient } from "./formatters.js";
import { computeAgeInYears } from "./validation.js";
import { HIGH_PRIORITY_TASK_LEVELS, OPEN_TASK_STATUSES, PROTEINURIA_MONITORING_INTERVAL_DAYS } from "./clinical-config.js";
import { MADISON_GRACE_PATIENT_ID, OLIVIA_BENNETT_PATIENT_ID } from "./madison-class-iv-data.js";
import {
  ATTENTION_REASON_PRIORITY,
  type AttentionReason,
  type ClinicianWorklistResponse,
  type MonitoringStatus,
  type WorklistObservationValue,
  type WorklistPatientView,
  type WorklistSummary,
} from "./worklist-types.js";

const PROTEINURIA_MONITORING_INTERVAL_MS = PROTEINURIA_MONITORING_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

export function sortDemoPatientViews(views: WorklistPatientView[]): WorklistPatientView[] {
  const demoPriority = new Map([
    [MADISON_GRACE_PATIENT_ID, 0],
    [OLIVIA_BENNETT_PATIENT_ID, 1],
  ]);
  return [...views].sort((a, b) => {
    const priorityA = demoPriority.get(a.patient.id ?? "") ?? 2;
    const priorityB = demoPriority.get(b.patient.id ?? "") ?? 2;
    return priorityA - priorityB || a.name.localeCompare(b.name);
  });
}

function toWorklistValue(observation: fhir4.Observation | undefined): WorklistObservationValue | undefined {
  if (!observation) return undefined;
  const quantity = getObservationQuantityValue(observation);
  if (!quantity) return undefined;
  return { value: quantity.value, unit: quantity.unit, date: observation.effectiveDateTime ?? observation.issued };
}

function latestResourceDate(...dates: (string | undefined)[]): string | undefined {
  const valid = dates.filter((date): date is string => !!date);
  if (valid.length === 0) return undefined;
  return valid.reduce((latest, current) => (current > latest ? current : latest));
}

function isOpenTask(task: fhir4.Task): boolean {
  return (OPEN_TASK_STATUSES as readonly string[]).includes(task.status);
}

function isOverdueHighPriorityTask(task: fhir4.Task): boolean {
  if (!isOpenTask(task)) return false;
  if (!task.priority || !(HIGH_PRIORITY_TASK_LEVELS as readonly string[]).includes(task.priority)) return false;
  const dueDate = task.restriction?.period?.end;
  if (!dueDate) return false;
  return Date.parse(dueDate) < Date.now();
}

interface TrendComparison {
  increased: boolean;
  decreased: boolean;
  hasTrend: boolean;
}

function compareLatestToPrevious(observations: fhir4.Observation[]): TrendComparison {
  const sorted = sortObservationsByDate(observations);
  if (sorted.length < 2) return { increased: false, decreased: false, hasTrend: false };

  const latest = getObservationQuantityValue(sorted[sorted.length - 1]!);
  const previous = getObservationQuantityValue(sorted[sorted.length - 2]!);
  if (!latest || !previous) return { increased: false, decreased: false, hasTrend: false };

  return { increased: latest.value > previous.value, decreased: latest.value < previous.value, hasTrend: true };
}

function buildPatientView(
  patient: fhir4.Patient,
  conditions: fhir4.Condition[],
  observations: fhir4.Observation[],
  tasks: fhir4.Task[],
): WorklistPatientView {
  const hasCopd = conditions.some(condition =>
    (condition.code?.coding?.some(coding =>
      (coding.system === "http://hl7.org/fhir/sid/icd-10-cm" && /^J44(?:\.|$)/.test(coding.code ?? "")) ||
      /chronic obstructive pulmonary disease|\bcopd\b/i.test(coding.display ?? ""),
    ) ?? false) || /chronic obstructive pulmonary disease|\bcopd\b/i.test(condition.code?.text ?? ""),
  );
  const hasLupusNephritis = conditions.some(isLupusNephritisCondition);
  const primaryCondition = conditions.find(isLupusNephritisCondition) ?? conditions[0];

  const upcrObservations = filterObservationsByLoinc(observations, LOINC_CODES.upcr);
  const egfrObservations = filterObservationsByLoinc(observations, LOINC_CODES.egfr);
  const creatinineObservations = filterObservationsByLoinc(observations, LOINC_CODES.serumCreatinine);
  const c3Observations = filterObservationsByLoinc(observations, LOINC_CODES.complementC3);
  const c4Observations = filterObservationsByLoinc(observations, LOINC_CODES.complementC4);
  const dsDnaObservations = filterObservationsByLoinc(observations, LOINC_CODES.antiDsDna);

  const latestUpcrObservation = getLatestObservation(upcrObservations);
  const latestEgfrObservation = getLatestObservation(egfrObservations);
  const latestUpcr = toWorklistValue(latestUpcrObservation);
  const latestEgfr = toWorklistValue(latestEgfrObservation);

  const upcrTrend = compareLatestToPrevious(upcrObservations);
  const egfrTrend = compareLatestToPrevious(egfrObservations);
  const creatinineTrend = compareLatestToPrevious(creatinineObservations);
  const c3Trend = compareLatestToPrevious(c3Observations);
  const c4Trend = compareLatestToPrevious(c4Observations);
  const dsDnaTrend = compareLatestToPrevious(dsDnaObservations);

  const openTasks = tasks.filter(isOpenTask);
  const hasOverdueHighPriorityTask = tasks.some(isOverdueHighPriorityTask);

  const hasAnyRelevantObservation =
    upcrObservations.length > 0 ||
    egfrObservations.length > 0 ||
    creatinineObservations.length > 0 ||
    c3Observations.length > 0 ||
    c4Observations.length > 0 ||
    dsDnaObservations.length > 0;

  let monitoringStatus: MonitoringStatus;
  if (!latestUpcrObservation) {
    monitoringStatus = "insufficient-data";
  } else {
    const upcrDate = latestUpcrObservation.effectiveDateTime ?? latestUpcrObservation.issued;
    if (!upcrDate) {
      monitoringStatus = "insufficient-data";
    } else if (Date.now() - Date.parse(upcrDate) > PROTEINURIA_MONITORING_INTERVAL_MS) {
      monitoringStatus = "overdue";
    } else {
      monitoringStatus = "current";
    }
  }

  const attentionReasons: AttentionReason[] = [];

  const possibleWorseningRenalPattern = upcrTrend.increased || egfrTrend.decreased || creatinineTrend.increased;
  if (possibleWorseningRenalPattern) attentionReasons.push("possible-worsening-renal-pattern");

  if (hasOverdueHighPriorityTask) attentionReasons.push("overdue-high-priority-task");

  if (hasLupusNephritis && monitoringStatus === "overdue") attentionReasons.push("proteinuria-monitoring-overdue");

  const hasSingleDataPointOnly =
    hasLupusNephritis && !possibleWorseningRenalPattern && hasAnyRelevantObservation && (!upcrTrend.hasTrend && !egfrTrend.hasTrend);
  if (hasSingleDataPointOnly) attentionReasons.push("requires-review");

  const serologyChange = c3Trend.decreased || c4Trend.decreased || dsDnaTrend.increased;
  if (serologyChange && !possibleWorseningRenalPattern) attentionReasons.push("serology-change");

  if (hasLupusNephritis && !hasAnyRelevantObservation) attentionReasons.push("insufficient-data");

  const primaryAttentionReason = ATTENTION_REASON_PRIORITY.find(reason => attentionReasons.includes(reason));

  const lastUpdated = latestResourceDate(
    patient.meta?.lastUpdated,
    ...conditions.map(c => c.meta?.lastUpdated),
    ...observations.map(o => o.meta?.lastUpdated),
    ...tasks.map(t => t.meta?.lastUpdated),
  );

  return {
    patient,
    name: formatPatientName(patient),
    age: patient.birthDate ? computeAgeInYears(patient.birthDate) : undefined,
    gender: patient.gender,
    active: patient.active !== false,
    hasCopd,
    hasLupusNephritis,
    primaryConditionText: primaryCondition ? formatConditionText(primaryCondition) : undefined,
    latestUpcr,
    latestEgfr,
    monitoringStatus,
    openTaskCount: openTasks.length,
    hasOverdueHighPriorityTask,
    attentionReasons,
    primaryAttentionReason,
    lastUpdated,
  };
}

export async function buildClinicianWorklist(): Promise<ClinicianWorklistResponse> {
  const [patientsResult, conditionsResult, observationsResult, tasksResult] = await Promise.all([
    fetchAllPages<fhir4.Patient>("Patient", "_count=100"),
    fetchAllPages<fhir4.Condition>("Condition", "_count=100"),
    fetchAllPages<fhir4.Observation>("Observation", "_count=100"),
    fetchAllPages<fhir4.Task>("Task", "_count=100"),
  ]);

  const views = sortDemoPatientViews(patientsResult.resources.map(patient => {
    const patientId = patient.id ?? "";
    const conditions = conditionsResult.resources.filter(c => referencesPatient(c.subject, patientId));
    const observations = observationsResult.resources.filter(o => referencesPatient(o.subject, patientId));
    const tasks = tasksResult.resources.filter(t => (t.for ? referencesPatient(t.for, patientId) : false));
    return buildPatientView(patient, conditions, observations, tasks);
  }));

  const attentionQueue = views
    .filter(view => view.attentionReasons.length > 0)
    .sort((a, b) => {
      const rankA = a.primaryAttentionReason
        ? ATTENTION_REASON_PRIORITY.indexOf(a.primaryAttentionReason)
        : ATTENTION_REASON_PRIORITY.length;
      const rankB = b.primaryAttentionReason
        ? ATTENTION_REASON_PRIORITY.indexOf(b.primaryAttentionReason)
        : ATTENTION_REASON_PRIORITY.length;
      return rankA - rankB;
    });

  const summary: WorklistSummary = {
    totalPatients: views.length,
    lupusNephritisPatients: views.filter(v => v.hasLupusNephritis).length,
    needsReview: views.filter(
      v =>
        v.primaryAttentionReason === "possible-worsening-renal-pattern" ||
        v.primaryAttentionReason === "requires-review" ||
        v.primaryAttentionReason === "serology-change",
    ).length,
    monitoringOverdue: views.filter(v => v.monitoringStatus === "overdue").length,
    openHighPriorityTasks: tasksResult.resources.filter(isOverdueHighPriorityTask).length,
    insufficientData: views.filter(v => v.monitoringStatus === "insufficient-data").length,
  };

  return {
    summary,
    attentionQueue,
    allPatients: views,
    partial: {
      conditions: !conditionsResult.complete,
      observations: !observationsResult.complete,
      tasks: !tasksResult.complete,
    },
    generatedAt: new Date().toISOString(),
  };
}
