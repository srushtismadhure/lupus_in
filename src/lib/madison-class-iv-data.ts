import { LOINC_CODES, LOINC_SYSTEM } from "./fhir-observations.js";

export const MADISON_GRACE_PATIENT_ID = "a40f6629-abe0-48d2-acbf-8df0055f3f68";
export const OLIVIA_BENNETT_PATIENT_ID = "815aee67-810e-468b-8c16-7e9aa60d2758";
export const MADISON_GRACE_NAME = "Madison Grace";
export const SYNTHETIC_IDENTIFIER_SYSTEM = "https://example.org/fhir/identifier/synthetic-ln";
export const PATHOLOGY_CODE_SYSTEM = "https://example.org/fhir/CodeSystem/lupus-nephritis-pathology";
export const LN_CLASS_CODE_SYSTEM = "https://example.org/fhir/CodeSystem/lupus-nephritis-class";
export const SYNTHETIC_NOTE = "Synthetic demo data — not real patient data.";
export const PATHOLOGY_REPORT_IDENTIFIER = "madison-class-iv-biopsy-2025-07-15";
export const BIOPSY_SPECIMEN_IDENTIFIER = "madison-renal-biopsy-2025-07-15";

export const RENAL_DATES = ["2025-05-15", "2025-07-15", "2025-08-15", "2025-10-15", "2026-01-15", "2026-07-15"] as const;

export type RenalDate = (typeof RENAL_DATES)[number];

export interface LongitudinalMetricDefinition {
  key: string;
  display: string;
  codeSystem: string;
  code: string;
  values: readonly (number | "present" | "absent")[];
  unit?: string;
  ucumCode?: string;
  valueKind: "quantity" | "coded";
}

export const LONGITUDINAL_METRICS: readonly LongitudinalMetricDefinition[] = [
  {
    key: "egfr",
    display: "eGFR (CKD-EPI 2021)",
    codeSystem: LOINC_SYSTEM,
    code: LOINC_CODES.egfr,
    values: [96, 54, 63, 72, 78, 82],
    unit: "mL/min/1.73 m²",
    ucumCode: "mL/min/{1.73_m2}",
    valueKind: "quantity",
  },
  {
    key: "upcr",
    display: "Urine protein-to-creatinine ratio (UPCR)",
    codeSystem: LOINC_SYSTEM,
    code: LOINC_CODES.upcr,
    values: [0.3, 4.8, 3.5, 2.1, 1.0, 0.6],
    unit: "g/g creatinine",
    ucumCode: "g/g{creat}",
    valueKind: "quantity",
  },
  {
    key: "creatinine",
    display: "Serum creatinine",
    codeSystem: LOINC_SYSTEM,
    code: LOINC_CODES.serumCreatinine,
    values: [0.8, 1.5, 1.3, 1.1, 1.0, 0.9],
    unit: "mg/dL",
    ucumCode: "mg/dL",
    valueKind: "quantity",
  },
  {
    key: "albumin",
    display: "Serum albumin",
    codeSystem: LOINC_SYSTEM,
    code: LOINC_CODES.serumAlbumin,
    values: [4.1, 2.4, 2.7, 3.1, 3.5, 3.8],
    unit: "g/dL",
    ucumCode: "g/dL",
    valueKind: "quantity",
  },
  {
    key: "c3",
    display: "Complement C3",
    codeSystem: LOINC_SYSTEM,
    code: LOINC_CODES.complementC3,
    values: [102, 48, 58, 70, 82, 94],
    unit: "mg/dL",
    ucumCode: "mg/dL",
    valueKind: "quantity",
  },
  {
    key: "c4",
    display: "Complement C4",
    codeSystem: LOINC_SYSTEM,
    code: LOINC_CODES.complementC4,
    values: [20, 6, 8, 10, 13, 17],
    unit: "mg/dL",
    ucumCode: "mg/dL",
    valueKind: "quantity",
  },
  {
    key: "anti-dsdna",
    display: "Anti-double-stranded DNA antibody",
    codeSystem: LOINC_SYSTEM,
    code: LOINC_CODES.antiDsDna,
    values: [25, 180, 145, 105, 74, 42],
    unit: "IU/mL",
    ucumCode: "[IU]/mL",
    valueKind: "quantity",
  },
  {
    key: "urine-rbc",
    display: "Urine red blood cells",
    codeSystem: PATHOLOGY_CODE_SYSTEM,
    code: "urine-rbc-per-hpf",
    values: [3, 85, 55, 25, 12, 5],
    unit: "cells/HPF",
    valueKind: "quantity",
  },
  {
    key: "rbc-casts",
    display: "Urine red blood cell casts",
    codeSystem: PATHOLOGY_CODE_SYSTEM,
    code: "urine-rbc-casts",
    values: ["absent", "present", "present", "absent", "absent", "absent"],
    valueKind: "coded",
  },
] as const;

export interface PathologyFindingDefinition {
  key: string;
  display: string;
  valueInteger?: number;
  valueCodeableConcept?: fhir4.CodeableConcept;
  low?: number;
  high?: number;
  weightingFactor?: number;
  index: "classification" | "activity" | "chronicity";
}

export const PATHOLOGY_FINDINGS: readonly PathologyFindingDefinition[] = [
  {
    key: "class",
    display: "ISN/RPS lupus nephritis class",
    valueCodeableConcept: {
      coding: [{ system: LN_CLASS_CODE_SYSTEM, code: "IV", display: "ISN/RPS Class IV diffuse lupus nephritis" }],
      text: "ISN/RPS Class IV — diffuse lupus nephritis",
    },
    index: "classification",
  },
  { key: "activity-index", display: "NIH lupus nephritis activity index", valueInteger: 12, low: 0, high: 24, index: "activity" },
  { key: "chronicity-index", display: "NIH lupus nephritis chronicity index", valueInteger: 3, low: 0, high: 12, index: "chronicity" },
  { key: "endocapillary-hypercellularity", display: "Endocapillary hypercellularity", valueInteger: 3, low: 0, high: 3, index: "activity" },
  { key: "neutrophils-karyorrhexis", display: "Neutrophils and karyorrhexis", valueInteger: 2, low: 0, high: 3, index: "activity" },
  { key: "fibrinoid-necrosis", display: "Fibrinoid necrosis", valueInteger: 1, low: 0, high: 3, weightingFactor: 2, index: "activity" },
  { key: "hyaline-deposits", display: "Hyaline deposits", valueInteger: 1, low: 0, high: 3, index: "activity" },
  {
    key: "cellular-crescents",
    display: "Cellular or fibrocellular crescents",
    valueInteger: 1,
    low: 0,
    high: 3,
    weightingFactor: 2,
    index: "activity",
  },
  { key: "interstitial-inflammation", display: "Interstitial inflammation", valueInteger: 2, low: 0, high: 3, index: "activity" },
  { key: "glomerulosclerosis", display: "Glomerulosclerosis", valueInteger: 1, low: 0, high: 3, index: "chronicity" },
  { key: "fibrous-crescents", display: "Fibrous crescents", valueInteger: 0, low: 0, high: 3, index: "chronicity" },
  { key: "tubular-atrophy", display: "Tubular atrophy", valueInteger: 1, low: 0, high: 3, index: "chronicity" },
  { key: "interstitial-fibrosis", display: "Interstitial fibrosis", valueInteger: 1, low: 0, high: 3, index: "chronicity" },
] as const;

export const ACTIVITY_LESION_KEYS = [
  "endocapillary-hypercellularity",
  "neutrophils-karyorrhexis",
  "fibrinoid-necrosis",
  "hyaline-deposits",
  "cellular-crescents",
  "interstitial-inflammation",
] as const;

export const CHRONICITY_LESION_KEYS = ["glomerulosclerosis", "fibrous-crescents", "tubular-atrophy", "interstitial-fibrosis"] as const;

export function calculatePathologyIndex(keys: readonly string[]): number {
  return keys.reduce((sum, key) => {
    const finding = PATHOLOGY_FINDINGS.find(item => item.key === key);
    return sum + (finding?.valueInteger ?? 0) * (finding?.weightingFactor ?? 1);
  }, 0);
}

export function stableIdentifier(value: string): fhir4.Identifier {
  return { system: SYNTHETIC_IDENTIFIER_SYSTEM, value };
}

function mergeIdentifier(existing: fhir4.Identifier[] | undefined, value: string): fhir4.Identifier[] {
  return [...(existing ?? []).filter(identifier => identifier.system !== SYNTHETIC_IDENTIFIER_SYSTEM || identifier.value !== value), stableIdentifier(value)];
}

function syntheticNotes(existing: fhir4.Annotation[] | undefined, extra?: string): fhir4.Annotation[] {
  const values = [...(existing ?? []).map(note => note.text), SYNTHETIC_NOTE, extra].filter((text): text is string => Boolean(text));
  const texts = new Set(values);
  return Array.from(texts, text => ({ text }));
}

function preserveMeta<T extends fhir4.Resource>(existing: T | undefined): Pick<T, "id" | "meta"> {
  return existing ? ({ id: existing.id, meta: existing.meta } as Pick<T, "id" | "meta">) : ({} as Pick<T, "id" | "meta">);
}

export function buildBiopsySpecimen(patientId: string, existing?: fhir4.Specimen): fhir4.Specimen {
  return {
    ...existing,
    resourceType: "Specimen",
    ...preserveMeta(existing),
    identifier: mergeIdentifier(existing?.identifier, BIOPSY_SPECIMEN_IDENTIFIER),
    status: "available",
    type: { text: "Renal biopsy specimen" },
    subject: { reference: `Patient/${patientId}`, display: MADISON_GRACE_NAME },
    receivedTime: "2025-07-15T12:00:00-07:00",
    collection: { collectedDateTime: "2025-07-15T09:00:00-07:00", bodySite: { text: "Kidney" } },
    note: syntheticNotes(existing?.note, "Synthetic educational renal biopsy specimen context."),
  };
}

export function pathologyObservationIdentifier(key: string): string {
  return `madison-class-iv-biopsy-${key}-2025-07-15`;
}

export function buildPathologyObservation(
  finding: PathologyFindingDefinition,
  patientId: string,
  specimenReference: string,
  existing?: fhir4.Observation,
): fhir4.Observation {
  const weightingText = finding.weightingFactor ? `NIH index weighting factor: ×${finding.weightingFactor}.` : undefined;
  return {
    ...existing,
    resourceType: "Observation",
    ...preserveMeta(existing),
    identifier: mergeIdentifier(existing?.identifier, pathologyObservationIdentifier(finding.key)),
    status: "final",
    category: [
      {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "exam", display: "Exam" }],
        text: "Renal pathology",
      },
    ],
    code: { coding: [{ system: PATHOLOGY_CODE_SYSTEM, code: finding.key, display: finding.display }], text: finding.display },
    subject: { reference: `Patient/${patientId}`, display: MADISON_GRACE_NAME },
    effectiveDateTime: "2025-07-15",
    specimen: { reference: specimenReference, display: "Synthetic renal biopsy specimen" },
    ...(finding.valueCodeableConcept
      ? { valueCodeableConcept: finding.valueCodeableConcept, valueInteger: undefined }
      : { valueInteger: finding.valueInteger, valueCodeableConcept: undefined }),
    ...(finding.low !== undefined || finding.high !== undefined
      ? { referenceRange: [{ low: finding.low !== undefined ? { value: finding.low } : undefined, high: finding.high !== undefined ? { value: finding.high } : undefined }] }
      : { referenceRange: undefined }),
    note: syntheticNotes(existing?.note, weightingText),
  };
}

export function longitudinalObservationIdentifier(metricKey: string, date: RenalDate): string {
  return `madison-ln-${metricKey}-${date}`;
}

export function buildLongitudinalObservation(
  metric: LongitudinalMetricDefinition,
  date: RenalDate,
  value: number | "present" | "absent",
  patientId: string,
  existing?: fhir4.Observation,
): fhir4.Observation {
  const identifierValue = longitudinalObservationIdentifier(metric.key, date);
  const base: fhir4.Observation = {
    ...existing,
    resourceType: "Observation",
    ...preserveMeta(existing),
    identifier: mergeIdentifier(existing?.identifier, identifierValue),
    status: "final",
    category: [
      {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory", display: "Laboratory" }],
        text: metric.key.startsWith("urine-") || metric.key === "upcr" || metric.key === "rbc-casts" ? "Urine studies" : "Laboratory",
      },
    ],
    code: { coding: [{ system: metric.codeSystem, code: metric.code, display: metric.display }], text: metric.display },
    subject: { reference: `Patient/${patientId}`, display: MADISON_GRACE_NAME },
    effectiveDateTime: date,
    note: syntheticNotes(existing?.note),
  };

  if (metric.valueKind === "coded") {
    base.valueCodeableConcept = {
      coding: [{ system: PATHOLOGY_CODE_SYSTEM, code: String(value), display: value === "present" ? "Present" : "Absent" }],
      text: value === "present" ? "Present" : "Absent",
    };
    delete base.valueQuantity;
  } else {
    base.valueQuantity = {
      value: value as number,
      unit: metric.unit,
      ...(metric.ucumCode ? { system: "http://unitsofmeasure.org", code: metric.ucumCode } : {}),
    };
    delete base.valueCodeableConcept;
  }

  return base;
}

export function buildPathologyReport(
  patientId: string,
  specimenReference: string,
  resultReferences: fhir4.Reference[],
  existing?: fhir4.DiagnosticReport,
): fhir4.DiagnosticReport {
  return {
    ...existing,
    resourceType: "DiagnosticReport",
    ...preserveMeta(existing),
    identifier: mergeIdentifier(existing?.identifier, PATHOLOGY_REPORT_IDENTIFIER),
    status: "final",
    category: [{ text: "Pathology" }],
    code: { text: "Renal biopsy pathology report" },
    subject: { reference: `Patient/${patientId}`, display: MADISON_GRACE_NAME },
    effectiveDateTime: "2025-07-15",
    issued: "2025-07-18T12:00:00Z",
    specimen: [{ reference: specimenReference, display: "Synthetic renal biopsy specimen" }],
    result: resultReferences,
    conclusion:
      "Diffuse proliferative lupus nephritis, ISN/RPS Class IV. NIH activity index 12/24 and chronicity index 3/12. Synthetic educational pathology record — not real patient data.",
    conclusionCode: [
      {
        coding: [{ system: LN_CLASS_CODE_SYSTEM, code: "IV", display: "ISN/RPS Class IV diffuse lupus nephritis" }],
        text: "ISN/RPS Class IV diffuse lupus nephritis",
      },
    ],
    extension: [
      ...(existing?.extension ?? []).filter(extension => extension.url !== "https://example.org/fhir/StructureDefinition/synthetic-data"),
      { url: "https://example.org/fhir/StructureDefinition/synthetic-data", valueBoolean: true },
    ],
  };
}

const TREATMENT_PHASE_EXTENSION = "https://example.org/fhir/StructureDefinition/lupus-nephritis-treatment-phase";
const RENAL_RESPONSE_EXTENSION = "https://example.org/fhir/StructureDefinition/lupus-nephritis-renal-response";

export function buildConfirmedClassIvCondition(existing: fhir4.Condition, pathologyReportReference: string): fhir4.Condition {
  const extensions = (existing.extension ?? []).filter(
    extension => extension.url !== TREATMENT_PHASE_EXTENSION && extension.url !== RENAL_RESPONSE_EXTENSION,
  );
  const stages = (existing.stage ?? []).filter(stage => stage.type?.text !== "ISN/RPS lupus nephritis classification");
  const evidence = (existing.evidence ?? []).map(item => ({ ...item, detail: [...(item.detail ?? [])] }));
  const pathologyReference = { reference: pathologyReportReference, display: "Renal biopsy pathology report" };
  const pathologyEvidence = evidence.find(item => item.code?.some(code => code.text === "Renal biopsy pathology"));
  if (pathologyEvidence) {
    pathologyEvidence.detail = [...(pathologyEvidence.detail ?? []).filter(detail => detail.reference !== pathologyReportReference), pathologyReference];
  } else {
    evidence.push({ code: [{ text: "Renal biopsy pathology" }], detail: [pathologyReference] });
  }

  return {
    ...existing,
    resourceType: "Condition",
    code: { ...existing.code, text: "Biopsy-confirmed lupus nephritis" },
    clinicalStatus: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active", display: "Active" }],
    },
    verificationStatus: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed", display: "Confirmed" }],
    },
    onsetDateTime: "2025-07-15",
    recordedDate: "2026-07-15",
    stage: [
      ...stages,
      {
        summary: {
          coding: [{ system: LN_CLASS_CODE_SYSTEM, code: "IV", display: "ISN/RPS Class IV diffuse lupus nephritis" }],
          text: "ISN/RPS Class IV — diffuse lupus nephritis",
        },
        type: { text: "ISN/RPS lupus nephritis classification" },
        assessment: [pathologyReference],
      },
    ],
    evidence,
    extension: [
      ...extensions,
      { url: TREATMENT_PHASE_EXTENSION, valueCodeableConcept: { text: "Maintenance" } },
      { url: RENAL_RESPONSE_EXTENSION, valueCodeableConcept: { text: "Partial response, approaching complete response" } },
    ],
    note: syntheticNotes(
      (existing.note ?? []).filter(note => !note.text?.toLowerCase().includes("provisional") && !note.text?.toLowerCase().includes("biopsy not")),
      "Biopsy-confirmed ISN/RPS Class IV diffuse lupus nephritis. Synthetic educational record; not real patient data.",
    ),
  };
}

export function getTreatmentPhase(condition: fhir4.Condition): string | undefined {
  return condition.extension?.find(extension => extension.url === TREATMENT_PHASE_EXTENSION)?.valueCodeableConcept?.text;
}

export function getRenalResponse(condition: fhir4.Condition): string | undefined {
  return condition.extension?.find(extension => extension.url === RENAL_RESPONSE_EXTENSION)?.valueCodeableConcept?.text;
}

export interface MedicationSeedDefinition {
  key: string;
  medicationText: string;
  identifier: string;
  startDate: string;
  reason: string;
  reasonCondition: "sle" | "ln";
  dosageInstruction: fhir4.Dosage[];
}

function oralRoute(): fhir4.CodeableConcept {
  return { text: "Oral" };
}

function subcutaneousRoute(): fhir4.CodeableConcept {
  return { text: "Subcutaneous" };
}

function dose(value: number, unit: string): fhir4.DosageDoseAndRate[] {
  return [{ doseQuantity: { value, unit } }];
}

export const MEDICATION_SEEDS: readonly MedicationSeedDefinition[] = [
  {
    key: "hydroxychloroquine",
    medicationText: "Hydroxychloroquine",
    identifier: "madison-hydroxychloroquine-2024-01-01",
    startDate: "2024-01-01",
    reason: "Systemic lupus erythematosus",
    reasonCondition: "sle",
    dosageInstruction: [
      {
        sequence: 1,
        text: "200 mg by mouth twice daily",
        route: oralRoute(),
        timing: { repeat: { frequency: 2, period: 1, periodUnit: "d", boundsPeriod: { start: "2024-01-01" } }, code: { text: "Twice daily" } },
        doseAndRate: dose(200, "mg"),
      },
    ],
  },
  {
    key: "prednisone",
    medicationText: "Prednisone",
    identifier: "madison-prednisone-taper-2025-07-18",
    startDate: "2025-07-18",
    reason: "Induction taper for Class IV lupus nephritis",
    reasonCondition: "ln",
    dosageInstruction: [
      { sequence: 1, text: "40 mg by mouth daily", route: oralRoute(), timing: { repeat: { frequency: 1, period: 1, periodUnit: "d", boundsPeriod: { start: "2025-07-18", end: "2025-08-14" } }, code: { text: "Daily" } }, doseAndRate: dose(40, "mg") },
      { sequence: 2, text: "20 mg by mouth daily", route: oralRoute(), timing: { repeat: { frequency: 1, period: 1, periodUnit: "d", boundsPeriod: { start: "2025-08-15", end: "2025-10-14" } }, code: { text: "Daily" } }, doseAndRate: dose(20, "mg") },
      { sequence: 3, text: "10 mg by mouth daily", route: oralRoute(), timing: { repeat: { frequency: 1, period: 1, periodUnit: "d", boundsPeriod: { start: "2025-10-15", end: "2026-01-14" } }, code: { text: "Daily" } }, doseAndRate: dose(10, "mg") },
      { sequence: 4, text: "7.5 mg by mouth daily", route: oralRoute(), timing: { repeat: { frequency: 1, period: 1, periodUnit: "d", boundsPeriod: { start: "2026-01-15", end: "2026-07-14" } }, code: { text: "Daily" } }, doseAndRate: dose(7.5, "mg") },
      { sequence: 5, text: "5 mg by mouth daily", route: oralRoute(), timing: { repeat: { frequency: 1, period: 1, periodUnit: "d", boundsPeriod: { start: "2026-07-15" } }, code: { text: "Daily" } }, doseAndRate: dose(5, "mg") },
    ],
  },
  {
    key: "mycophenolate",
    medicationText: "Mycophenolate mofetil",
    identifier: "madison-mmf-2025-07-15",
    startDate: "2025-07-15",
    reason: "Induction and maintenance treatment for Class IV lupus nephritis",
    reasonCondition: "ln",
    dosageInstruction: [
      { sequence: 1, text: "500 mg by mouth twice daily", route: oralRoute(), timing: { repeat: { frequency: 2, period: 1, periodUnit: "d", boundsPeriod: { start: "2025-07-15", end: "2025-07-31" } }, code: { text: "Twice daily" } }, doseAndRate: dose(500, "mg") },
      { sequence: 2, text: "1,500 mg by mouth twice daily", route: oralRoute(), timing: { repeat: { frequency: 2, period: 1, periodUnit: "d", boundsPeriod: { start: "2025-08-01" } }, code: { text: "Twice daily" } }, doseAndRate: dose(1500, "mg") },
    ],
  },
  {
    key: "belimumab",
    medicationText: "Belimumab",
    identifier: "madison-belimumab-2025-10-15",
    startDate: "2025-10-15",
    reason: "Persistent proteinuria above the month-3 response target",
    reasonCondition: "ln",
    dosageInstruction: [
      {
        sequence: 1,
        text: "200 mg subcutaneously weekly",
        route: subcutaneousRoute(),
        timing: { repeat: { frequency: 1, period: 1, periodUnit: "wk", boundsPeriod: { start: "2025-10-15" } }, code: { text: "Weekly" } },
        doseAndRate: dose(200, "mg"),
      },
    ],
  },
  {
    key: "losartan",
    medicationText: "Losartan",
    identifier: "madison-losartan-2025-08-15",
    startDate: "2025-08-15",
    reason: "Blood-pressure and antiproteinuric support",
    reasonCondition: "ln",
    dosageInstruction: [
      {
        sequence: 1,
        text: "50 mg by mouth daily",
        route: oralRoute(),
        timing: { repeat: { frequency: 1, period: 1, periodUnit: "d", boundsPeriod: { start: "2025-08-15" } }, code: { text: "Daily" } },
        doseAndRate: dose(50, "mg"),
      },
    ],
  },
] as const;

export function buildMedicationRequest(
  seed: MedicationSeedDefinition,
  patientId: string,
  sleConditionId: string,
  lupusNephritisConditionId: string,
  existing?: fhir4.MedicationRequest,
): fhir4.MedicationRequest {
  const conditionId = seed.reasonCondition === "sle" ? sleConditionId : lupusNephritisConditionId;
  return {
    ...existing,
    resourceType: "MedicationRequest",
    ...preserveMeta(existing),
    identifier: mergeIdentifier(existing?.identifier, seed.identifier),
    status: "active",
    intent: "order",
    medicationCodeableConcept: { ...(existing?.medicationCodeableConcept ?? {}), text: seed.medicationText },
    subject: { reference: `Patient/${patientId}`, display: MADISON_GRACE_NAME },
    authoredOn: seed.startDate,
    dosageInstruction: seed.dosageInstruction,
    reasonReference: [{ reference: `Condition/${conditionId}`, display: seed.reason }],
    reasonCode: [{ text: seed.reason }],
    note: syntheticNotes(existing?.note),
  };
}

export const METHYLPREDNISOLONE_DATES = ["2025-07-15", "2025-07-16", "2025-07-17"] as const;

export function methylprednisoloneIdentifier(date: string): string {
  return `madison-methylprednisolone-pulse-${date}`;
}

export function buildMethylprednisoloneAdministration(
  date: (typeof METHYLPREDNISOLONE_DATES)[number],
  patientId: string,
  lupusNephritisConditionId: string,
  existing?: fhir4.MedicationAdministration,
): fhir4.MedicationAdministration {
  return {
    ...existing,
    resourceType: "MedicationAdministration",
    ...preserveMeta(existing),
    identifier: mergeIdentifier(existing?.identifier, methylprednisoloneIdentifier(date)),
    status: "completed",
    medicationCodeableConcept: { text: "Methylprednisolone" },
    subject: { reference: `Patient/${patientId}`, display: MADISON_GRACE_NAME },
    effectiveDateTime: `${date}T09:00:00-07:00`,
    reasonReference: [{ reference: `Condition/${lupusNephritisConditionId}`, display: "Pulse induction therapy for Class IV lupus nephritis" }],
    dosage: { text: "500 mg intravenous pulse", route: { text: "Intravenous" }, dose: { value: 500, unit: "mg" } },
    note: syntheticNotes(existing?.note, "Pulse induction therapy."),
  };
}

export function resourceHasSyntheticIdentifier(resource: { identifier?: fhir4.Identifier[] }, value: string): boolean {
  return resource.identifier?.some(identifier => identifier.system === SYNTHETIC_IDENTIFIER_SYSTEM && identifier.value === value) ?? false;
}

export function isM32Code(condition: fhir4.Condition, code: string): boolean {
  return condition.code?.coding?.some(coding => coding.system === "http://hl7.org/fhir/sid/icd-10-cm" && coding.code === code) ?? false;
}
