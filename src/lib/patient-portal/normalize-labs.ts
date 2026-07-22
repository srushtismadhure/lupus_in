import { LAB_EXPLANATIONS, UNKNOWN_LAB_EXPLANATION } from "./explanations/lab-explanations.js";
import { LAB_STATUS_LABELS, LAB_TREND_LABELS } from "./explanations/status-language.js";
import { normalizeReviewStatus } from "./normalize-review-status.js";
import type { PatientFriendlyLabResult, PatientLabStatus, PatientLabTrend } from "./types.js";

const SUPPORTED_CODES = new Set(Object.keys(LAB_EXPLANATIONS));
const LOWER_IS_IMPROVING = new Set(["2160-0", "2890-2", "5130-0"]);
const HIGHER_IS_IMPROVING = new Set(["98979-8", "4485-9", "4498-2", "1751-7"]);

function codingKey(observation: fhir4.Observation): { key: string; code: string } | null {
  const coding = observation.code.coding?.find(item => item.code && (!item.system || item.system === "http://loinc.org"));
  if (!coding?.code || !SUPPORTED_CODES.has(coding.code)) return null;
  return { key: `${coding.system ?? "http://loinc.org"}|${coding.code}`, code: coding.code };
}

function dateOf(observation: fhir4.Observation): string | null {
  return observation.effectiveDateTime ?? observation.effectivePeriod?.start ?? observation.issued ?? null;
}

function valueOf(observation: fhir4.Observation): number | string | null {
  return (
    observation.valueQuantity?.value ??
    observation.valueInteger ??
    observation.valueString ??
    observation.valueCodeableConcept?.text ??
    observation.valueCodeableConcept?.coding?.[0]?.display ??
    null
  );
}

function unitOf(observation: fhir4.Observation): string | null {
  return observation.valueQuantity?.unit ?? observation.valueQuantity?.code ?? null;
}

function referenceRange(observation: fhir4.Observation): PatientFriendlyLabResult["referenceRange"] {
  const range = observation.referenceRange?.[0];
  if (!range) return null;
  const result = { low: range.low?.value, high: range.high?.value, text: range.text };
  return result.low === undefined && result.high === undefined && !result.text ? null : result;
}

function rangeStatus(observation: fhir4.Observation, value: number | string | null): PatientLabStatus {
  if (observation.status === "preliminary" || observation.status === "registered") return "awaiting-review";
  if (value === null) return "insufficient-data";
  const range = referenceRange(observation);
  if (!range || typeof value !== "number") return "range-unavailable";
  const insideLow = range.low === undefined || value >= range.low;
  const insideHigh = range.high === undefined || value <= range.high;
  return insideLow && insideHigh ? "within-reported-range" : "outside-reported-range";
}

function trendFor(code: string, observations: fhir4.Observation[]): PatientLabTrend {
  if (observations.length < 2) return "insufficient-data";
  const [latest, previous] = observations;
  const latestValue = latest?.valueQuantity?.value;
  const previousValue = previous?.valueQuantity?.value;
  if (latestValue === undefined || previousValue === undefined) return "not-applicable";
  const latestUnit = unitOf(latest!);
  const previousUnit = unitOf(previous!);
  if (!latestUnit || !previousUnit || latestUnit !== previousUnit) return "insufficient-data";
  if (latestValue === previousValue) return "stable";
  if (LOWER_IS_IMPROVING.has(code)) return latestValue < previousValue ? "improving" : "worsening";
  if (HIGHER_IS_IMPROVING.has(code)) return latestValue > previousValue ? "improving" : "worsening";
  return "changing";
}

function sourceOf(observation: fhir4.Observation): string {
  return observation.performer?.map(item => item.display).filter(Boolean).join(", ") || "Medical record";
}

export function normalizeLabs(observations: fhir4.Observation[]): PatientFriendlyLabResult[] {
  const grouped = new Map<string, { code: string; observations: fhir4.Observation[] }>();
  for (const observation of observations.filter(item => !["entered-in-error", "cancelled"].includes(item.status))) {
    const coding = codingKey(observation);
    if (!coding) continue;
    const group = grouped.get(coding.key) ?? { code: coding.code, observations: [] };
    group.observations.push(observation);
    grouped.set(coding.key, group);
  }

  return [...grouped.values()]
    .map(group => {
      const sorted = [...group.observations].sort((a, b) => (dateOf(b) ?? "").localeCompare(dateOf(a) ?? ""));
      const latest = sorted[0]!;
      const value = valueOf(latest);
      const status = rangeStatus(latest, value);
      const trend = trendFor(group.code, sorted);
      const explanation = LAB_EXPLANATIONS[group.code] ?? UNKNOWN_LAB_EXPLANATION;
      const review = normalizeReviewStatus(latest);
      const name = latest.code.text ?? latest.code.coding?.[0]?.display ?? explanation.plainLanguageName;
      const whatItMayMean =
        status === "within-reported-range"
          ? "This value falls within the reference range supplied with this result. Your care team may use a different personal target."
          : status === "outside-reported-range"
            ? "This value falls outside the reference range supplied with this result. One result does not define a diagnosis or treatment change."
            : explanation.rangeUnavailable;

      return {
        id: latest.id ?? `${group.code}-${dateOf(latest) ?? "undated"}`,
        fhirReference: latest.id ? `Observation/${latest.id}` : "Observation",
        category: explanation.category,
        name,
        plainLanguageName: explanation.plainLanguageName,
        value,
        unit: unitOf(latest),
        date: dateOf(latest),
        referenceRange: referenceRange(latest),
        patientTarget: null,
        trend,
        trendLabel: LAB_TREND_LABELS[trend],
        status,
        statusLabel: LAB_STATUS_LABELS[status],
        reviewStatus: review.status,
        reviewStatusLabel: review.label,
        whatItChecks: explanation.whatItChecks,
        whatItMayMean,
        nextStep: explanation.nextStep,
        source: sourceOf(latest),
        history: sorted.map(item => ({
          id: item.id ?? `${group.code}-${dateOf(item) ?? "undated"}`,
          value: valueOf(item),
          unit: unitOf(item),
          date: dateOf(item),
        })),
        reviewedAt: review.reviewedAt,
        reviewedBy: review.reviewedBy,
        preliminary: latest.status === "preliminary" || latest.status === "registered",
      } satisfies PatientFriendlyLabResult;
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.plainLanguageName.localeCompare(b.plainLanguageName));
}

