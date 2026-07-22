import { computeAgeInYears } from "./validation";
import { CKD_ICD10_PREFIX, LUPUS_NEPHRITIS_ICD10_CODE } from "./clinical-config";

export function formatPatientName(patient: fhir4.Patient): string {
  const names = patient.name ?? [];
  const chosen = names.find(name => name.use === "official") ?? names[0];
  if (!chosen) return "Unknown patient";

  const parts = [...(chosen.given ?? []), chosen.family].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Unknown patient";
}

export function formatPatientAge(patient: fhir4.Patient): string | undefined {
  if (!patient.birthDate) return undefined;
  return `${computeAgeInYears(patient.birthDate)}`;
}

export function formatConditionText(condition: fhir4.Condition): string {
  return condition.code?.text ?? condition.code?.coding?.[0]?.display ?? condition.code?.coding?.[0]?.code ?? "Unspecified condition";
}

export function formatMedicationText(medicationRequest: fhir4.MedicationRequest): string {
  return (
    medicationRequest.medicationCodeableConcept?.text ??
    medicationRequest.medicationCodeableConcept?.coding?.[0]?.display ??
    medicationRequest.medicationReference?.display ??
    medicationRequest.medicationCodeableConcept?.coding?.[0]?.code ??
    "Unknown medication"
  );
}

export function formatObservationName(observation: fhir4.Observation): string {
  return observation.code.text ?? observation.code.coding?.[0]?.display ?? observation.code.coding?.[0]?.code ?? "Observation";
}

export function isLupusNephritisCondition(condition: fhir4.Condition): boolean {
  const text = formatConditionText(condition).toLowerCase();
  if (text.includes("lupus nephritis")) return true;
  return condition.code?.coding?.some(coding => coding.code === LUPUS_NEPHRITIS_ICD10_CODE) ?? false;
}

export function isChronicKidneyDiseaseCondition(condition: fhir4.Condition): boolean {
  const text = formatConditionText(condition).toLowerCase();
  if (text.includes("chronic kidney disease") || text.includes("ckd")) return true;
  return condition.code?.coding?.some(coding => coding.code?.startsWith(CKD_ICD10_PREFIX)) ?? false;
}

/** Lupus nephritis OR chronic kidney disease — the population this app's renal-nutrition workflow targets. */
export function isRenalDiagnosisCondition(condition: fhir4.Condition): boolean {
  return isLupusNephritisCondition(condition) || isChronicKidneyDiseaseCondition(condition);
}

/** Checks whether a `Reference` points at the given Patient, tolerating absolute vs relative reference formats. */
export function referencesPatient(reference: fhir4.Reference | undefined, patientId: string): boolean {
  if (!reference?.reference) return false;
  return reference.reference === `Patient/${patientId}` || reference.reference.endsWith(`/Patient/${patientId}`);
}
