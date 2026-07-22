/**
 * Normalizes raw FHIR Condition/Observation/Task resources into a stable internal
 * shape so the renal CDS rules engine (renal-cds-rules.ts) never has to inspect
 * nested FHIR JSON directly. Reuses the same cohort-detection helpers as the rest
 * of the app (formatters.ts) rather than re-deriving lupus-nephritis logic here.
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

/** Text fallback for synthetic records that may not carry an exact LOINC coding. */
const MEASUREMENT_TEXT_FALLBACK: { type: RenalMeasurementType; keywords: string[] }[] = [
  { type: "upcr", keywords: ["upcr", "urine protein", "protein-to-creatinine"] },
  { type: "egfr", keywords: ["egfr", "estimated glomerular filtration"] },
  { type: "creatinine", keywords: ["creatinine"] },
];

const GENERAL_LUPUS_KEYWORDS = ["lupus", "systemic lupus erythematosus", "sle"];
const RENAL_FOLLOW_UP_KEYWORDS = ["renal", "nephrology", "kidney", "upcr", "creatinine", "egfr", "proteinuria"];

const RELEVANT_TASK_STATUSES = new Set(["requested", "accepted", "in-progress", "completed"]);

function effectiveDateOf(observation: fhir4.Observation): string | undefined {
  return observation.effectiveDateTime ?? observation.effectivePeriod?.start ?? observation.issued;
}

function classifyObservation(observation: fhir4.Observation): RenalMeasurementType | undefined {
  const codings = observation.code?.coding ?? [];
  for (const coding of codings) {
    if (coding.code && MEASUREMENT_LOINC_MAP[coding.code]) return MEASUREMENT_LOINC_MAP[coding.code];
  }

  const text = (observation.code?.text ?? codings[0]?.display ?? "").toLowerCase();
  const fallback = MEASUREMENT_TEXT_FALLBACK.find(entry => entry.keywords.some(k => text.includes(k)));
  return fallback?.type;
}

function hasGeneralLupus(conditions: fhir4.Condition[]): boolean {
  return conditions.some(c => {
    const text = formatConditionText(c).toLowerCase();
    const icd = c.code?.coding?.some(coding => coding.code?.startsWith("M32"));
    return GENERAL_LUPUS_KEYWORDS.some(k => text.includes(k)) || icd;
  });
}

export function normalizeRenalData(patientId: string, conditions: fhir4.Condition[], observations: fhir4.Observation[], tasks: fhir4.Task[]): NormalizedRenalData {
  const measurements: RenalMeasurement[] = [];

  for (const observation of observations) {
    const type = classifyObservation(observation);
    if (!type) continue; // do not silently treat an unknown Observation as a renal measurement

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

  const renalTasks: RenalTask[] = tasks
    .filter(t => {
      if (!t.status || !RELEVANT_TASK_STATUSES.has(t.status)) return false;
      const text = `${t.description ?? ""} ${t.code?.text ?? ""} ${t.code?.coding?.[0]?.display ?? ""}`.toLowerCase();
      return RENAL_FOLLOW_UP_KEYWORDS.some(k => text.includes(k));
    })
    .map(t => ({ id: t.id, status: t.status, description: t.description, authoredOn: t.authoredOn, lastModified: t.lastModified }));

  return {
    patientId,
    hasLupus: hasGeneralLupus(conditions),
    hasLupusNephritis: conditions.some(isLupusNephritisCondition),
    measurements,
    tasks: renalTasks,
  };
}
