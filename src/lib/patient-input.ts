import { isValidAdministrativeGender, isValidCalendarDateString, isFutureDateString, validateNamePart } from "./validation";

/** Shape submitted by the create/edit patient forms. Validated on the server — never trust the browser. */
export interface PatientFormInput {
  givenName: string;
  familyName: string;
  middleName?: string;
  displayName?: string;
  birthDate: string;
  gender: string;
  identifier?: string;
  phone?: string;
  email?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface PatientInputValidationError {
  field: string;
  message: string;
}

export function validatePatientInput(input: Partial<PatientFormInput>): PatientInputValidationError[] {
  const errors: PatientInputValidationError[] = [];

  const given = validateNamePart(input.givenName ?? "");
  if (!given.valid) errors.push({ field: "givenName", message: "Enter a valid first name." });

  const family = validateNamePart(input.familyName ?? "");
  if (!family.valid) errors.push({ field: "familyName", message: "Enter a valid last name." });

  if (!input.birthDate || !isValidCalendarDateString(input.birthDate)) {
    errors.push({ field: "birthDate", message: "Enter a valid date of birth." });
  } else if (isFutureDateString(input.birthDate)) {
    errors.push({ field: "birthDate", message: "Date of birth cannot be in the future." });
  }

  if (!input.gender || !isValidAdministrativeGender(input.gender)) {
    errors.push({ field: "gender", message: "Select a valid administrative gender." });
  }

  return errors;
}

/** Builds a new FHIR R4 Patient resource from validated form input, omitting empty optional fields. */
export function buildPatientResource(input: PatientFormInput, identifierValue: string): fhir4.Patient {
  const given = input.givenName.trim();
  const family = input.familyName.trim();
  const middle = input.middleName?.trim();
  const givenNames = middle ? [given, middle] : [given];
  const displayText = input.displayName?.trim() || [given, middle, family].filter(Boolean).join(" ");

  const telecom: fhir4.ContactPoint[] = [];
  if (input.phone?.trim()) telecom.push({ system: "phone", value: input.phone.trim() });
  if (input.email?.trim()) telecom.push({ system: "email", value: input.email.trim() });

  const address: fhir4.Address[] = [];
  if (input.addressLine?.trim() || input.city?.trim() || input.state?.trim() || input.postalCode?.trim()) {
    address.push({
      ...(input.addressLine?.trim() ? { line: [input.addressLine.trim()] } : {}),
      ...(input.city?.trim() ? { city: input.city.trim() } : {}),
      ...(input.state?.trim() ? { state: input.state.trim() } : {}),
      ...(input.postalCode?.trim() ? { postalCode: input.postalCode.trim() } : {}),
    });
  }

  const patient: fhir4.Patient = {
    resourceType: "Patient",
    active: true,
    identifier: [{ system: "https://nephra.demo/patient-id", value: identifierValue }],
    name: [
      {
        use: "official",
        given: givenNames,
        family,
        text: displayText,
      },
    ],
    gender: input.gender as fhir4.Patient["gender"],
    birthDate: input.birthDate,
  };

  if (telecom.length > 0) patient.telecom = telecom;
  if (address.length > 0) patient.address = address;

  return patient;
}

/**
 * Merges edited fields into the latest server-known Patient resource, preserving every field the
 * edit form doesn't touch (identifiers, extensions, contact, communication, etc.).
 */
export function mergePatientResource(existing: fhir4.Patient, input: PatientFormInput): fhir4.Patient {
  const given = input.givenName.trim();
  const family = input.familyName.trim();
  const middle = input.middleName?.trim();
  const givenNames = middle ? [given, middle] : [given];
  const displayText = input.displayName?.trim() || [given, middle, family].filter(Boolean).join(" ");

  const existingOfficialIndex = existing.name?.findIndex(name => name.use === "official") ?? -1;
  const nextName: fhir4.HumanName = {
    use: "official",
    given: givenNames,
    family,
    text: displayText,
  };

  const names = existing.name ? [...existing.name] : [];
  if (existingOfficialIndex >= 0) {
    names[existingOfficialIndex] = nextName;
  } else {
    names.unshift(nextName);
  }

  const telecom = [...(existing.telecom ?? [])].filter(t => t.system !== "phone" && t.system !== "email");
  if (input.phone?.trim()) telecom.push({ system: "phone", value: input.phone.trim() });
  if (input.email?.trim()) telecom.push({ system: "email", value: input.email.trim() });

  return {
    ...existing,
    name: names,
    gender: input.gender as fhir4.Patient["gender"],
    birthDate: input.birthDate,
    ...(telecom.length > 0 ? { telecom } : {}),
  };
}
