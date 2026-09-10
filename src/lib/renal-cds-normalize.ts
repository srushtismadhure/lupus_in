/**
 * Legacy patient-view normalization. Renal data remains supported while Waypoint's
 * COPD Home Health medication-reconciliation task is also normalized so the existing
 * patient-view CDS endpoint can surface the handoff without a second CDS endpoint.
 */
import { formatConditionText, isLupusNephritisCondition } from "./formatters.js";
import { LOINC_CODES } from "./fhir-observations.js";

export type RenalMeasurementType = "upcr" | "egfr" | "creatinine";

export interface RenalMeasurement {
  type: RenalMeasurementType;
  value: number;
  unit: string;
  date: string;
  observationId?: string;
  code?: string;
  display?: string;
}

export interface RenalTask {
  id?: string;
  status?: string;
  description?: string;
  authoredOn?: string;
  lastModified?: string;
  kind?: "renal-follow-up" | "home-health-medication-review";
}

export interface NormalizedRenalData {
  patientId: string;
  hasLupus: boolean;
  hasLupusNephritis: boolean;
  measurements: RenalMeasurement[];
  tasks: RenalTask[];
}

const MEASUREMENT_LOINC_MAP: Record<string, RenalMeasurementType> = {
  [LOINC_CODES.upcr]: "upcr",
  [LOINC_CODES.egfr]: "egfr",
  [LOINC_CODES.serumCreatinine]: "creatinine",
};

const MEASUREMENT_TEXT_FALLBACK: { type: RenalMeasurementType; keywords: string[] }[] = [
  { type: "upcr", keywords: ["upcr", "urine protein", "protein-to-creatinine"] },
  { type: "egfr", keywords: ["egfr", "estimated glomerular filtration"] },
  { type: "creatinine", keywords: ["creatinine"] },
];

const GENERAL_LUPUS_KEYWORDS = ["lupus", "systemic lupus erythematosus", "sle"];
const RENAL_FOLLOW_UP_KEYWORDS = ["renal", "nephrology", "kidney", "upcr", "creatinine", "egfr", "proteinuria"];
const HOME_HEALTH_MED_REVIEW = "review home health medication reconciliation";
const RELEVANT_TASK_STATUSES = new Set(["requested", "accepted", "ready", "in-progress", "completed"]);

function effectiveDateOf(observation: fhir4.Observation): string | undefined {
  return observation.effectiveDateTime ?? observation.effectivePeriod?.start ?? observation.issued;
}

function classifyObservation(observation: fhir4.Observation): RenalMeasurementType | undefined {
  for (const coding of observation.code?.coding ?? []) {
    if (coding.code && MEASUREMENT_LOINC_MAP[coding.code]) return MEASUREMENT_LOINC_MAP[coding.code];
  }
  const text = (observation.code?.text ?? observation.code?.coding?.[0]?.display ?? "").toLowerCase();
  return MEASUREMENT_TEXT_FALLBACK.find(entry => entry.keywords.some(k => text.includes(k)))?.type;
}

function hasGeneralLupus(conditions: fhir4.Condition[]): boolean {
  return conditions.some(c => {
    const text = formatConditionText(c).toLowerCase();
    const icd = c.code?.coding?.some(coding => coding.code?.startsWith("M32"));
    return GENERAL_LUPUS_KEYWORDS.some(k => text.includes(k)) || icd;
  });
}

export function normalizeRenalData(
  patientId: string,
  conditions: fhir4.Condition[],
  observations: fhir4.Observation[],
  tasks: fhir4.Task[],
): NormalizedRenalData {
  const measurements: RenalMeasurement[] = [];

  for (const observation of observations) {
    const type = classifyObservation(observation);
    if (!type) continue;
    const value = observation.valueQuantity?.value;
    const date = effectiveDateOf(observation);
    if (value === undefined || !date) continue;
    measurements.push({
      type,
      value,
      unit: observation.valueQuantity?.unit ?? "",
      date,
      observationId: observation.id,
      code: observation.code?.coding?.[0]?.code,
      display: observation.code?.text ?? observation.code?.coding?.[0]?.display,
    });
  }
  measurements.sort((a, b) => a.date.localeCompare(b.date));

  const normalizedTasks: RenalTask[] = tasks
    .filter(t => !!t.status && RELEVANT_TASK_STATUSES.has(t.status))
    .flatMap(t => {
      const text = `${t.description ?? ""} ${t.code?.text ?? ""} ${t.code?.coding?.[0]?.display ?? ""}`.toLowerCase();
      const kind = text.includes(HOME_HEALTH_MED_REVIEW)
        ? "home-health-medication-review" as const
        : RENAL_FOLLOW_UP_KEYWORDS.some(k => text.includes(k))
          ? "renal-follow-up" as const
          : null;
      return kind ? [{ id: t.id, status: t.status, description: t.description, authoredOn: t.authoredOn, lastModified: t.lastModified, kind }] : [];
    });

  return {
    patientId,
    hasLupus: hasGeneralLupus(conditions),
    hasLupusNephritis: conditions.some(isLupusNephritisCondition),
    measurements,
    tasks: normalizedTasks,
  };
}
