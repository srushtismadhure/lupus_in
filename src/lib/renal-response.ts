import { formatMedicationText, isLupusNephritisCondition, referencesPatient } from "./formatters.js";
import {
  ACTIVITY_LESION_KEYS,
  CHRONICITY_LESION_KEYS,
  LONGITUDINAL_METRICS,
  PATHOLOGY_FINDINGS,
  PATHOLOGY_REPORT_IDENTIFIER,
  SYNTHETIC_IDENTIFIER_SYSTEM,
  SYNTHETIC_NOTE,
  calculatePathologyIndex,
  getRenalResponse,
  getTreatmentPhase,
  resourceHasSyntheticIdentifier,
} from "./madison-class-iv-data.js";

export const OVERVIEW_HERO_METRICS = ["protein-leakage", "kidney-function", "renal-inflammation", "treatment"] as const;
export const INFLAMMATION_METRICS = ["upcr", "c3", "c4", "anti-dsdna", "albumin", "urine-rbc", "rbc-casts"] as const;

export type RenalViewMode = "renal-response" | "renal-surveillance";

export interface FhirProvenance {
  resourceType: string;
  resourceId?: string;
  code?: string;
  codeSystem?: string;
  display: string;
  effectiveDate?: string;
  status?: string;
  sourceReference?: string;
  synthetic: boolean;
}

export interface RenalSeriesPoint {
  date: string;
  value: number | string;
  unit?: string;
  provenance: FhirProvenance;
}

export interface RenalMetricSeries {
  key: string;
  display: string;
  unit?: string;
  points: RenalSeriesPoint[];
}

export interface PathologyFindingView {
  key: string;
  display: string;
  value: number | string;
  low?: number;
  high?: number;
  weightingFactor?: number;
  index: "classification" | "activity" | "chronicity";
  provenance: FhirProvenance;
}

export interface MedicationDosePeriod {
  start: string;
  end?: string;
  doseText: string;
}

export interface MedicationExposure {
  id?: string;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  currentDose?: string;
  route?: string;
  reason?: string;
  dosePeriods: MedicationDosePeriod[];
  administrationDates: string[];
  provenance: FhirProvenance;
}

export interface KidneyReserve {
  preFlare: number;
  nadir: number;
  current: number;
  recoveredLoss: number;
  totalLoss: number;
  recoveryPercentage?: number;
  residualLoss: number;
  recentSlope: "Stable" | "Improving" | "Declining";
}

export interface InflammationComparison {
  key: string;
  display: string;
  flare: RenalSeriesPoint;
  latest: RenalSeriesPoint;
  interpretation: string;
  referenceRange?: string;
}

export interface RenalResponseModel {
  mode: RenalViewMode;
  patientId: string;
  diagnosis?: {
    title: string;
    classification: string;
    lupusNephritisClass: string;
    biopsyDate: string;
    treatmentPhase: string;
    renalResponse: string;
    provenance: FhirProvenance;
  };
  pathologyReport?: {
    conclusion: string;
    provenance: FhirProvenance;
  };
  pathologyFindings: PathologyFindingView[];
  activityIndex?: number;
  chronicityIndex?: number;
  series: Record<string, RenalMetricSeries>;
  kidneyReserve?: KidneyReserve;
  inflammation: InflammationComparison[];
  medications: MedicationExposure[];
  proteinuriaReductionPercentage?: number;
  clinicalSummary: string[];
  syntheticWarning: string;
}

export interface RenalResponseResources {
  patient: fhir4.Patient;
  conditions: fhir4.Condition[];
  diagnosticReports: fhir4.DiagnosticReport[];
  observations: fhir4.Observation[];
  medicationRequests: fhir4.MedicationRequest[];
  medicationAdministrations: fhir4.MedicationAdministration[];
}

function compact<T>(values: Array<T | undefined>): T[] {
  return values.filter((value): value is T => value !== undefined);
}

function identifierValue(resource: { identifier?: fhir4.Identifier[] }): string | undefined {
  return resource.identifier?.find(identifier => identifier.system === SYNTHETIC_IDENTIFIER_SYSTEM)?.value;
}

function effectiveDate(resource: fhir4.Observation | fhir4.DiagnosticReport | fhir4.MedicationAdministration): string | undefined {
  if (resource.resourceType === "Observation") return resource.effectiveDateTime ?? resource.effectivePeriod?.start ?? resource.issued;
  if (resource.resourceType === "DiagnosticReport") return resource.effectiveDateTime ?? resource.effectivePeriod?.start ?? resource.issued;
  return resource.effectiveDateTime ?? resource.effectivePeriod?.start;
}

function codeDetails(resource: fhir4.Observation | fhir4.Condition | fhir4.DiagnosticReport): Pick<FhirProvenance, "code" | "codeSystem" | "display"> {
  const coding = resource.code?.coding?.[0];
  return {
    code: coding?.code,
    codeSystem: coding?.system,
    display: resource.code?.text ?? coding?.display ?? coding?.code ?? resource.resourceType,
  };
}

function hasSyntheticMarker(resource: fhir4.DomainResource & { identifier?: fhir4.Identifier[]; note?: fhir4.Annotation[] }): boolean {
  return (
    resource.identifier?.some(identifier => identifier.system === SYNTHETIC_IDENTIFIER_SYSTEM) === true ||
    resource.note?.some(note => note.text?.toLowerCase().includes("synthetic")) === true ||
    resource.extension?.some(extension => extension.url === "https://example.org/fhir/StructureDefinition/synthetic-data" && extension.valueBoolean === true) === true
  );
}

function observationProvenance(observation: fhir4.Observation): FhirProvenance {
  return {
    resourceType: "Observation",
    resourceId: observation.id,
    ...codeDetails(observation),
    effectiveDate: effectiveDate(observation),
    status: observation.status,
    sourceReference: observation.derivedFrom?.[0]?.reference,
    synthetic: hasSyntheticMarker(observation),
  };
}

function medicationProvenance(request: fhir4.MedicationRequest): FhirProvenance {
  const coding = request.medicationCodeableConcept?.coding?.[0];
  return {
    resourceType: "MedicationRequest",
    resourceId: request.id,
    code: coding?.code,
    codeSystem: coding?.system,
    display: formatMedicationText(request),
    effectiveDate: request.dosageInstruction?.map(dosage => dosage.timing?.repeat?.boundsPeriod?.start).filter(Boolean).sort()[0] ?? request.authoredOn,
    status: request.status,
    sourceReference: request.reasonReference?.[0]?.reference,
    synthetic: hasSyntheticMarker(request),
  };
}

function normalizeQuantity(metricKey: string, quantity: fhir4.Quantity): { value: number; unit?: string } | undefined {
  if (quantity.value === undefined) return undefined;
  if (metricKey === "upcr") {
    const normalizedUnit = `${quantity.unit ?? ""} ${quantity.code ?? ""}`.toLowerCase();
    if (normalizedUnit.includes("mg/g")) return { value: quantity.value / 1000, unit: "g/g creatinine" };
    return { value: quantity.value, unit: "g/g creatinine" };
  }
  if (metricKey === "egfr") return { value: quantity.value, unit: "mL/min/1.73 m²" };
  return { value: quantity.value, unit: quantity.unit };
}

function buildSeries(observations: fhir4.Observation[]): Record<string, RenalMetricSeries> {
  const result: Record<string, RenalMetricSeries> = {};
  for (const metric of LONGITUDINAL_METRICS) {
    const points = compact(
      observations
      .filter(observation => identifierValue(observation)?.startsWith(`madison-ln-${metric.key}-`))
      .map((observation): RenalSeriesPoint | undefined => {
        const date = effectiveDate(observation)?.slice(0, 10);
        if (!date) return undefined;
        if (metric.valueKind === "coded") {
          const value = observation.valueCodeableConcept?.text ?? observation.valueCodeableConcept?.coding?.[0]?.display;
          if (!value) return undefined;
          return { date, value, provenance: observationProvenance(observation) } satisfies RenalSeriesPoint;
        }
        const normalized = observation.valueQuantity ? normalizeQuantity(metric.key, observation.valueQuantity) : undefined;
        if (!normalized) return undefined;
        return { date, value: normalized.value, unit: normalized.unit, provenance: observationProvenance(observation) } satisfies RenalSeriesPoint;
      }),
    ).sort((a, b) => a.date.localeCompare(b.date));
    result[metric.key] = { key: metric.key, display: metric.display, unit: points[0]?.unit ?? metric.unit, points };
  }
  return result;
}

export function calculateKidneyReserve(egfrPoints: RenalSeriesPoint[]): KidneyReserve | undefined {
  const values = egfrPoints.filter(point => typeof point.value === "number");
  if (values.length < 2) return undefined;
  const preFlare = values[0]!.value as number;
  const nadir = Math.min(...values.map(point => point.value as number));
  const current = values[values.length - 1]!.value as number;
  const totalLoss = preFlare - nadir;
  const recoveredLoss = current - nadir;
  const residualLoss = preFlare - current;
  const recoveryPercentage = totalLoss === 0 ? undefined : Math.round((recoveredLoss / totalLoss) * 100);
  const previous = values[values.length - 2]!.value as number;
  const change = current - previous;
  const recentSlope = Math.abs(change) <= 5 ? "Stable" : change > 0 ? "Improving" : "Declining";
  return { preFlare, nadir, current, recoveredLoss, totalLoss, recoveryPercentage, residualLoss, recentSlope };
}

function pointAt(series: RenalMetricSeries | undefined, date: string): RenalSeriesPoint | undefined {
  return series?.points.find(point => point.date === date);
}

function latestPoint(series: RenalMetricSeries | undefined): RenalSeriesPoint | undefined {
  return series?.points[series.points.length - 1];
}

function inflammationInterpretation(key: string, flare: RenalSeriesPoint, latest: RenalSeriesPoint): string {
  if (key === "c3") return "Recovered";
  if (key === "c4") return "Near normal";
  if (key === "albumin") return "Recovered";
  if (key === "rbc-casts") return String(latest.value).toLowerCase() === "absent" ? "Resolved" : "Persistent";
  if (["upcr", "anti-dsdna", "urine-rbc"].includes(key)) {
    return Number(latest.value) < Number(flare.value) ? (key === "upcr" ? "Major improvement" : "Improving") : "Not improving";
  }
  return "Review";
}

function buildInflammation(series: Record<string, RenalMetricSeries>): InflammationComparison[] {
  return compact(INFLAMMATION_METRICS.map((key): InflammationComparison | undefined => {
    const metric = series[key];
    const flare = pointAt(metric, "2025-07-15");
    const latest = latestPoint(metric);
    if (!metric || !flare || !latest) return undefined;
    return {
      key,
      display: metric.display,
      flare,
      latest,
      interpretation: inflammationInterpretation(key, flare, latest),
    } satisfies InflammationComparison;
  }));
}

function currentDose(request: fhir4.MedicationRequest): string | undefined {
  const dosage = [...(request.dosageInstruction ?? [])]
    .sort((a, b) => (b.timing?.repeat?.boundsPeriod?.start ?? "").localeCompare(a.timing?.repeat?.boundsPeriod?.start ?? ""))
    .find(item => !item.timing?.repeat?.boundsPeriod?.end);
  return dosage?.text;
}

function buildMedicationExposures(
  requests: fhir4.MedicationRequest[],
  administrations: fhir4.MedicationAdministration[],
): MedicationExposure[] {
  const seededRequests = requests.filter(request => request.identifier?.some(identifier => identifier.system === SYNTHETIC_IDENTIFIER_SYSTEM));
  const exposures: MedicationExposure[] = seededRequests.map((request): MedicationExposure => {
    const dosePeriods = compact(
      (request.dosageInstruction ?? []).map((dosage): MedicationDosePeriod | undefined => {
        const start = dosage.timing?.repeat?.boundsPeriod?.start;
        if (!start) return undefined;
        return { start, end: dosage.timing?.repeat?.boundsPeriod?.end, doseText: dosage.text ?? "Dose not reported" };
      }),
    ).sort((a, b) => a.start.localeCompare(b.start));
    return {
      id: request.id,
      name: formatMedicationText(request),
      status: request.status,
      startDate: dosePeriods[0]?.start ?? request.authoredOn,
      endDate: dosePeriods[dosePeriods.length - 1]?.end,
      currentDose: currentDose(request),
      route: request.dosageInstruction?.[0]?.route?.text,
      reason: request.reasonCode?.[0]?.text ?? request.reasonReference?.[0]?.display,
      dosePeriods,
      administrationDates: [] as string[],
      provenance: medicationProvenance(request),
    } satisfies MedicationExposure;
  });

  const pulseAdministrations = administrations
    .filter(administration => identifierValue(administration)?.startsWith("madison-methylprednisolone-pulse-"))
    .sort((a, b) => (effectiveDate(a) ?? "").localeCompare(effectiveDate(b) ?? ""));
  if (pulseAdministrations.length > 0) {
    const first = pulseAdministrations[0]!;
    const coding = first.medicationCodeableConcept?.coding?.[0];
    exposures.push({
      id: first.id,
      name: first.medicationCodeableConcept?.text ?? coding?.display ?? "Methylprednisolone",
      status: "completed",
      startDate: effectiveDate(first)?.slice(0, 10),
      endDate: effectiveDate(pulseAdministrations[pulseAdministrations.length - 1]!)?.slice(0, 10),
      currentDose: undefined,
      route: first.dosage?.route?.text,
      reason: first.reasonReference?.[0]?.display,
      dosePeriods: [],
      administrationDates: pulseAdministrations.map(administration => effectiveDate(administration)?.slice(0, 10)).filter((date): date is string => Boolean(date)),
      provenance: {
        resourceType: "MedicationAdministration",
        resourceId: first.id,
        code: coding?.code,
        codeSystem: coding?.system,
        display: first.medicationCodeableConcept?.text ?? coding?.display ?? "Methylprednisolone",
        effectiveDate: effectiveDate(first),
        status: first.status,
        sourceReference: first.reasonReference?.[0]?.reference,
        synthetic: hasSyntheticMarker(first),
      },
    });
  }
  return exposures.sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
}

function pathologyFindingViews(observations: fhir4.Observation[]): PathologyFindingView[] {
  return compact(PATHOLOGY_FINDINGS.map((definition): PathologyFindingView | undefined => {
    const observation = observations.find(item => resourceHasSyntheticIdentifier(item, `madison-class-iv-biopsy-${definition.key}-2025-07-15`));
    if (!observation) return undefined;
    const value = observation.valueInteger ?? observation.valueCodeableConcept?.text ?? observation.valueCodeableConcept?.coding?.[0]?.display;
    if (value === undefined) return undefined;
    return {
      key: definition.key,
      display: definition.display,
      value,
      low: observation.referenceRange?.[0]?.low?.value,
      high: observation.referenceRange?.[0]?.high?.value,
      weightingFactor: definition.weightingFactor,
      index: definition.index,
      provenance: observationProvenance(observation),
    } satisfies PathologyFindingView;
  }));
}

function renalResponseLabel(value: string | undefined): string {
  if (!value) return "Not reported";
  if (value.toLowerCase().includes("partial response") && value.toLowerCase().includes("approaching complete")) {
    return "Partial — approaching complete";
  }
  return value;
}

export function buildRenalResponseModel(resources: RenalResponseResources): RenalResponseModel {
  const patientId = resources.patient.id ?? "";
  const lupusNephritisCondition = resources.conditions.find(condition => referencesPatient(condition.subject, patientId) && isLupusNephritisCondition(condition));
  const classStage = lupusNephritisCondition?.stage?.find(stage => stage.type?.text === "ISN/RPS lupus nephritis classification");
  const lupusNephritisClass = classStage?.summary?.coding?.find(coding => coding.code)?.code;
  const confirmed = lupusNephritisCondition?.verificationStatus?.coding?.some(coding => coding.code === "confirmed") === true;
  if (!lupusNephritisCondition || !lupusNephritisClass || !confirmed) {
    return {
      mode: "renal-surveillance",
      patientId,
      pathologyFindings: [],
      series: {},
      inflammation: [],
      medications: [],
      clinicalSummary: [],
      syntheticWarning: SYNTHETIC_NOTE,
    };
  }

  const series = buildSeries(resources.observations.filter(observation => referencesPatient(observation.subject, patientId)));
  const kidneyReserve = calculateKidneyReserve(series.egfr?.points ?? []);
  const inflammation = buildInflammation(series);
  const pathologyFindings = pathologyFindingViews(resources.observations);
  const report = resources.diagnosticReports.find(item => resourceHasSyntheticIdentifier(item, PATHOLOGY_REPORT_IDENTIFIER));
  const flareUpcr = pointAt(series.upcr, "2025-07-15");
  const latestUpcr = latestPoint(series.upcr);
  const proteinuriaReductionPercentage =
    flareUpcr && latestUpcr && Number(flareUpcr.value) !== 0
      ? Math.round(((Number(flareUpcr.value) - Number(latestUpcr.value)) / Number(flareUpcr.value)) * 100)
      : undefined;
  const conditionCoding = lupusNephritisCondition.code?.coding?.[0];
  const diagnosisProvenance: FhirProvenance = {
    resourceType: "Condition",
    resourceId: lupusNephritisCondition.id,
    code: conditionCoding?.code,
    codeSystem: conditionCoding?.system,
    display: lupusNephritisCondition.code?.text ?? conditionCoding?.display ?? "Lupus nephritis",
    effectiveDate: lupusNephritisCondition.onsetDateTime,
    status: lupusNephritisCondition.clinicalStatus?.coding?.[0]?.code,
    sourceReference: classStage?.assessment?.[0]?.reference,
    synthetic: lupusNephritisCondition.note?.some(note => note.text?.toLowerCase().includes("synthetic")) === true,
  };
  const clinicalSummary = [
    proteinuriaReductionPercentage !== undefined ? `Proteinuria has fallen ${proteinuriaReductionPercentage}% from flare baseline.` : undefined,
    kidneyReserve ? `eGFR recovered from ${kidneyReserve.nadir} to ${kidneyReserve.current}.` : undefined,
    kidneyReserve ? `Current eGFR remains ${kidneyReserve.residualLoss} points below pre-flare baseline.` : undefined,
    "Complement levels are recovering.",
    "Anti-dsDNA is improving but remains above pre-flare baseline.",
    "Prednisone was tapered from 40 mg to 5 mg.",
    latestUpcr && Number(latestUpcr.value) > 0.5 ? "Current UPCR remains slightly above the complete-response threshold." : undefined,
  ].filter((statement): statement is string => Boolean(statement));

  return {
    mode: "renal-response",
    patientId,
    diagnosis: {
      title: "Biopsy-confirmed lupus nephritis",
      classification: classStage?.summary?.text ?? classStage?.summary?.coding?.[0]?.display ?? "ISN/RPS class not reported",
      lupusNephritisClass,
      biopsyDate: report ? effectiveDate(report)?.slice(0, 10) ?? lupusNephritisCondition.onsetDateTime ?? "" : lupusNephritisCondition.onsetDateTime ?? "",
      treatmentPhase: getTreatmentPhase(lupusNephritisCondition) ?? "Not reported",
      renalResponse: renalResponseLabel(getRenalResponse(lupusNephritisCondition)),
      provenance: diagnosisProvenance,
    },
    pathologyReport: report
      ? {
          conclusion: report.conclusion ?? "No conclusion reported",
          provenance: {
            resourceType: "DiagnosticReport",
            resourceId: report.id,
            ...codeDetails(report),
            effectiveDate: effectiveDate(report),
            status: report.status,
            sourceReference: report.result?.[0]?.reference,
            synthetic: hasSyntheticMarker(report),
          },
        }
      : undefined,
    pathologyFindings,
    activityIndex: Number(pathologyFindings.find(finding => finding.key === "activity-index")?.value ?? calculatePathologyIndex(ACTIVITY_LESION_KEYS)),
    chronicityIndex: Number(pathologyFindings.find(finding => finding.key === "chronicity-index")?.value ?? calculatePathologyIndex(CHRONICITY_LESION_KEYS)),
    series,
    kidneyReserve,
    inflammation,
    medications: buildMedicationExposures(resources.medicationRequests, resources.medicationAdministrations),
    proteinuriaReductionPercentage,
    clinicalSummary,
    syntheticWarning: SYNTHETIC_NOTE,
  };
}
