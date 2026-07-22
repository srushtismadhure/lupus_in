import { readFhirResource, searchFhirResource } from "../fhir-server-client.js";
import { referencesPatient } from "../formatters.js";
import type { CareCoordinationRawData } from "./types.js";

type SupportedResource =
  | fhir4.Condition
  | fhir4.Observation
  | fhir4.ServiceRequest
  | fhir4.Task
  | fhir4.CarePlan
  | fhir4.CareTeam
  | fhir4.Goal
  | fhir4.Appointment
  | fhir4.Encounter
  | fhir4.Communication;

interface SearchDefinition {
  key: Exclude<keyof CareCoordinationRawData, "patient" | "failedSections" | "resolvedReferences">;
  resourceType: SupportedResource["resourceType"];
  query: string;
}

function bundleResources<T extends SupportedResource>(bundle: fhir4.Bundle | null | undefined, resourceType: T["resourceType"]): T[] {
  return (bundle?.entry ?? [])
    .map(entry => entry.resource)
    .filter((resource): resource is T => resource?.resourceType === resourceType);
}

function belongsToPatient(resource: SupportedResource, patientId: string): boolean {
  switch (resource.resourceType) {
    case "Condition":
    case "Observation":
    case "ServiceRequest":
    case "CarePlan":
    case "Goal":
    case "Encounter":
    case "Communication":
      return referencesPatient(resource.subject, patientId);
    case "Task":
      return referencesPatient(resource.for, patientId);
    case "CareTeam":
      return referencesPatient(resource.subject, patientId);
    case "Appointment":
      return resource.participant?.some(participant => referencesPatient(participant.actor, patientId)) ?? false;
  }
}

async function safePatientSearch<T extends SupportedResource>(
  definition: SearchDefinition,
  patientId: string,
): Promise<{ resources: T[]; failed: boolean }> {
  const preferred = await searchFhirResource<fhir4.Bundle | fhir4.OperationOutcome>(definition.resourceType, definition.query);
  let response = preferred;

  if (preferred.status >= 400 && definition.query.includes("&")) {
    response = await searchFhirResource<fhir4.Bundle | fhir4.OperationOutcome>(
      definition.resourceType,
      `patient=${encodeURIComponent(patientId)}`,
    );
  }

  if (response.status !== 200 || response.body.resourceType !== "Bundle") return { resources: [], failed: true };
  const resources = bundleResources<T>(response.body, definition.resourceType as T["resourceType"]).filter(resource =>
    belongsToPatient(resource, patientId),
  );
  return { resources, failed: false };
}

function canonicalReference(reference: string): { resourceType: string; id: string; canonical: string } | null {
  const match = reference.match(/(?:^|\/)(PractitionerRole|Practitioner|Organization|HealthcareService|CareTeam)\/([^/]+)$/);
  if (!match?.[1] || !match[2]) return null;
  return { resourceType: match[1], id: match[2], canonical: `${match[1]}/${match[2]}` };
}

function resourceDisplay(resource: fhir4.Resource): string | undefined {
  if (resource.resourceType === "Practitioner") {
    const practitioner = resource as fhir4.Practitioner;
    const name = practitioner.name?.[0];
    return name?.text ?? ([...(name?.given ?? []), name?.family].filter(Boolean).join(" ") || undefined);
  }
  if (resource.resourceType === "PractitionerRole") {
    const role = resource as fhir4.PractitionerRole;
    return role.practitioner?.display ?? role.code?.[0]?.text;
  }
  if (resource.resourceType === "Organization") return (resource as fhir4.Organization).name;
  if (resource.resourceType === "HealthcareService") return (resource as fhir4.HealthcareService).name;
  if (resource.resourceType === "CareTeam") return (resource as fhir4.CareTeam).name;
  return undefined;
}

async function resolveReferences(raw: Omit<CareCoordinationRawData, "resolvedReferences">): Promise<CareCoordinationRawData["resolvedReferences"]> {
  const references = new Set<string>();
  for (const careTeam of raw.careTeams) {
    for (const participant of careTeam.participant ?? []) if (participant.member?.reference) references.add(participant.member.reference);
  }
  for (const task of raw.tasks) if (task.owner?.reference) references.add(task.owner.reference);
  for (const request of raw.serviceRequests) {
    if (request.requester?.reference) references.add(request.requester.reference);
    for (const performer of request.performer ?? []) if (performer.reference) references.add(performer.reference);
  }

  const resolved: CareCoordinationRawData["resolvedReferences"] = {};
  await Promise.all(
    [...references].map(async reference => {
      const parsed = canonicalReference(reference);
      if (!parsed) return;
      const result = await readFhirResource<fhir4.Resource | fhir4.OperationOutcome>(parsed.resourceType, parsed.id);
      if (result.status !== 200 || result.body.resourceType === "OperationOutcome") return;
      const display = resourceDisplay(result.body);
      if (display) resolved[parsed.canonical] = { display, resourceType: parsed.resourceType };
    }),
  );
  return resolved;
}

export async function loadCareCoordinationData(patientId: string): Promise<CareCoordinationRawData> {
  const patientResult = await readFhirResource<fhir4.Patient | fhir4.OperationOutcome>("Patient", patientId);
  if (patientResult.status !== 200 || patientResult.body.resourceType !== "Patient") {
    throw new Error("Patient could not be retrieved.");
  }

  const encodedPatientId = encodeURIComponent(patientId);
  const definitions: SearchDefinition[] = [
    { key: "conditions", resourceType: "Condition", query: `patient=${encodedPatientId}` },
    { key: "observations", resourceType: "Observation", query: `patient=${encodedPatientId}&_sort=-date&_count=200` },
    { key: "serviceRequests", resourceType: "ServiceRequest", query: `patient=${encodedPatientId}&_sort=-authored&_count=100` },
    { key: "tasks", resourceType: "Task", query: `patient=${encodedPatientId}&_sort=-modified&_count=100` },
    { key: "carePlans", resourceType: "CarePlan", query: `patient=${encodedPatientId}&_sort=-date&_count=50` },
    { key: "careTeams", resourceType: "CareTeam", query: `patient=${encodedPatientId}&_count=50` },
    { key: "goals", resourceType: "Goal", query: `patient=${encodedPatientId}&_count=100` },
    { key: "appointments", resourceType: "Appointment", query: `patient=${encodedPatientId}&_sort=-date&_count=100` },
    { key: "encounters", resourceType: "Encounter", query: `patient=${encodedPatientId}&_sort=-date&_count=100` },
    { key: "communications", resourceType: "Communication", query: `patient=${encodedPatientId}&_sort=-sent&_count=100` },
  ];

  const settled = await Promise.all(definitions.map(definition => safePatientSearch(definition, patientId)));
  const failedSections: string[] = [];
  const raw: Omit<CareCoordinationRawData, "resolvedReferences"> = {
    patient: patientResult.body,
    conditions: [],
    observations: [],
    serviceRequests: [],
    tasks: [],
    carePlans: [],
    careTeams: [],
    goals: [],
    appointments: [],
    encounters: [],
    communications: [],
    failedSections,
  };

  definitions.forEach((definition, index) => {
    const result = settled[index];
    if (!result) return;
    if (result.failed) failedSections.push(definition.resourceType);
    (raw[definition.key] as SupportedResource[]) = result.resources;
  });

  return { ...raw, resolvedReferences: await resolveReferences(raw) };
}
