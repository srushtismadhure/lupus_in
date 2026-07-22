export const LOINC_SYSTEM = "http://loinc.org";

export const LOINC_CODES = {
  upcr: "2890-2",
  serumCreatinine: "2160-0",
  egfr: "98979-8",
  complementC3: "4485-9",
  complementC4: "4498-2",
  antiDsDna: "5130-0",
  serumAlbumin: "1751-7",
  bloodPressurePanel: "85354-9",
  systolicBloodPressure: "8480-6",
  diastolicBloodPressure: "8462-4",
} as const;

function hasLoincCode(observation: fhir4.Observation, code: string): boolean {
  return observation.code.coding?.some(coding => coding.code === code && (!coding.system || coding.system === LOINC_SYSTEM)) ?? false;
}

export function filterObservationsByLoinc(observations: fhir4.Observation[], code: string): fhir4.Observation[] {
  return observations.filter(observation => hasLoincCode(observation, code));
}

function effectiveDateOf(observation: fhir4.Observation): string | undefined {
  return observation.effectiveDateTime ?? observation.effectivePeriod?.start ?? observation.issued;
}

/** Sorts observations chronologically by effective date; observations without a date sort last. */
export function sortObservationsByDate(observations: fhir4.Observation[]): fhir4.Observation[] {
  return [...observations].sort((a, b) => {
    const dateA = effectiveDateOf(a);
    const dateB = effectiveDateOf(b);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.localeCompare(dateB);
  });
}

export function getLatestObservation(observations: fhir4.Observation[]): fhir4.Observation | undefined {
  const sorted = sortObservationsByDate(observations);
  return sorted[sorted.length - 1];
}

export function getPreviousObservation(observations: fhir4.Observation[]): fhir4.Observation | undefined {
  const sorted = sortObservationsByDate(observations);
  return sorted.length >= 2 ? sorted[sorted.length - 2] : undefined;
}

export function getObservationEffectiveDate(observation: fhir4.Observation): string | undefined {
  return effectiveDateOf(observation);
}

export function getObservationQuantityValue(observation: fhir4.Observation): { value: number; unit?: string } | undefined {
  if (observation.valueQuantity?.value === undefined) return undefined;
  return { value: observation.valueQuantity.value, unit: observation.valueQuantity.unit };
}

export function getObservationInterpretation(observation: fhir4.Observation): string | undefined {
  return observation.interpretation?.[0]?.coding?.[0]?.display ?? observation.interpretation?.[0]?.text;
}

export interface BloodPressureReading {
  systolic?: { value: number; unit?: string };
  diastolic?: { value: number; unit?: string };
  effectiveDate?: string;
  interpretation?: string;
}

/** Reads systolic/diastolic values from a blood-pressure panel Observation's `component` array. */
export function readBloodPressureComponents(observation: fhir4.Observation): BloodPressureReading {
  const reading: BloodPressureReading = {
    effectiveDate: effectiveDateOf(observation),
    interpretation: getObservationInterpretation(observation),
  };

  for (const component of observation.component ?? []) {
    if (component.valueQuantity?.value === undefined) continue;
    const value = { value: component.valueQuantity.value, unit: component.valueQuantity.unit };
    const codes = component.code.coding ?? [];
    if (codes.some(coding => coding.code === LOINC_CODES.systolicBloodPressure)) {
      reading.systolic = value;
    } else if (codes.some(coding => coding.code === LOINC_CODES.diastolicBloodPressure)) {
      reading.diastolic = value;
    }
  }

  return reading;
}

export function getLatestBloodPressure(observations: fhir4.Observation[]): BloodPressureReading | undefined {
  const panels = filterObservationsByLoinc(observations, LOINC_CODES.bloodPressurePanel);
  const latest = getLatestObservation(panels);
  return latest ? readBloodPressureComponents(latest) : undefined;
}

export type TrendDirection = "up" | "down" | "unchanged";

/** Compares two numeric quantity values; only meaningful when both observations use the same unit. */
export function computeTrendDirection(
  latest: { value: number } | undefined,
  previous: { value: number } | undefined,
): TrendDirection | undefined {
  if (latest === undefined || previous === undefined) return undefined;
  if (latest.value === previous.value) return "unchanged";
  return latest.value > previous.value ? "up" : "down";
}
