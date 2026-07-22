import type { DialysisFacility, FhirDirectoryBundle, KidneyServiceRecord, KidneyTransplantProgram, ReferralPreview } from "./types.js";

const DIRECTORY_TYPE_SYSTEM = "https://luppedin.app/fhir/CodeSystem/kidney-service-directory-type";

function sanitizeId(value: string): string {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9-.]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized.slice(0, 64).replace(/-+$/g, "") || "kidney-service";
}

function isDialysisFacility(record: KidneyServiceRecord): record is DialysisFacility {
  return record.source === "CMS";
}

function recordIdentifier(record: KidneyServiceRecord): string {
  return isDialysisFacility(record) ? record.facilityId : record.centerCode;
}

function recordAddress(record: KidneyServiceRecord): fhir4.Address | undefined {
  if (isDialysisFacility(record)) {
    const line = record.address ? [record.address] : undefined;
    return {
      line,
      city: record.city ?? undefined,
      state: record.state ?? undefined,
      postalCode: record.zipCode ?? undefined,
      country: "US",
    };
  }
  return {
    city: record.city ?? undefined,
    state: record.state ?? undefined,
    country: "US",
  };
}

function directoryKind(record: KidneyServiceRecord): "transplant-program" | "dialysis-facility" {
  return isDialysisFacility(record) ? "dialysis-facility" : "transplant-program";
}

function serviceName(record: KidneyServiceRecord): string {
  return isDialysisFacility(record) ? "Dialysis Services" : "Kidney Transplant Program";
}

function serviceCode(record: KidneyServiceRecord): string {
  return isDialysisFacility(record) ? "dialysis-services" : "kidney-transplant-program";
}

export function createFhirDirectoryBundle(record: KidneyServiceRecord): FhirDirectoryBundle {
  const identifier = recordIdentifier(record);
  const idPrefix = sanitizeId(`${directoryKind(record)}-${identifier}`);
  const organizationId = `org-${idPrefix}`;
  const locationId = `loc-${idPrefix}`;
  const healthcareServiceId = `hs-${idPrefix}`;
  const organizationReference = `Organization/${organizationId}`;
  const locationReference = `Location/${locationId}`;

  const organization: fhir4.Organization = {
    resourceType: "Organization",
    id: organizationId,
    active: true,
    identifier: [
      {
        system: isDialysisFacility(record) ? "https://data.cms.gov/provider-data/dataset/dialysis-facility-ccn" : "https://srtr.hrsa.gov/transplant-center-code",
        value: identifier,
      },
    ],
    name: record.name,
    telecom: isDialysisFacility(record) && record.phone ? [{ system: "phone", value: record.phone }] : undefined,
  };

  const location: fhir4.Location = {
    resourceType: "Location",
    id: locationId,
    status: "active",
    name: record.name,
    address: recordAddress(record),
    position: isDialysisFacility(record) && record.latitude !== null && record.longitude !== null
      ? { latitude: record.latitude, longitude: record.longitude }
      : undefined,
    managingOrganization: { reference: organizationReference, display: record.name },
  };

  const healthcareService: fhir4.HealthcareService = {
    resourceType: "HealthcareService",
    id: healthcareServiceId,
    active: true,
    providedBy: { reference: organizationReference, display: record.name },
    location: [{ reference: locationReference, display: record.name }],
    name: serviceName(record),
    type: [
      {
        coding: [{ system: DIRECTORY_TYPE_SYSTEM, code: serviceCode(record), display: serviceName(record) }],
        text: serviceName(record),
      },
    ],
  };

  return {
    resourceType: "Bundle",
    type: "collection",
    id: `bundle-${idPrefix}`,
    entry: [
      { fullUrl: `urn:uuid:${organizationId}`, resource: organization },
      { fullUrl: `urn:uuid:${locationId}`, resource: location },
      { fullUrl: `urn:uuid:${healthcareServiceId}`, resource: healthcareService },
    ],
  };
}

export function createReferralPreview(record: KidneyServiceRecord, patientId?: string): ReferralPreview {
  const identifier = recordIdentifier(record);
  const idPrefix = sanitizeId(`${directoryKind(record)}-${identifier}`);
  const serviceRequestId = `draft-referral-${idPrefix}`;
  const taskId = `draft-referral-task-${idPrefix}`;
  const patientReference = patientId ? { reference: `Patient/${patientId}` } : undefined;
  const serviceRequestSubject: fhir4.Reference = patientReference ?? { display: "Patient context required" };
  const serviceDisplay = isDialysisFacility(record) ? "Dialysis services evaluation or coordination" : "Kidney transplant evaluation";

  const serviceRequest: fhir4.ServiceRequest = {
    resourceType: "ServiceRequest",
    id: serviceRequestId,
    status: "draft",
    intent: "proposal",
    subject: serviceRequestSubject,
    code: { text: serviceDisplay },
    performer: [{ reference: `HealthcareService/hs-${idPrefix}`, display: serviceName(record) }],
    note: [{ text: "Local preview only. This referral has not been written to FHIR." }],
  };

  const task: fhir4.Task = {
    resourceType: "Task",
    id: taskId,
    status: "draft",
    intent: "proposal",
    focus: { reference: `ServiceRequest/${serviceRequestId}` },
    description: "Coordinate referral and required records.",
  };
  if (patientReference) task.for = patientReference;

  return {
    serviceRequest,
    task,
    note: patientId ? null : "Open this directory from a patient chart to prepare a patient-specific referral.",
  };
}
