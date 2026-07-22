import { referencesPatient } from "./formatters.js";

const FHIR_PREFIX = "/fhir";

class FhirRequestError extends Error {
  status: number;
  operationOutcome?: fhir4.OperationOutcome;

  constructor(message: string, status: number, operationOutcome?: fhir4.OperationOutcome) {
    super(message);
    this.name = "FhirRequestError";
    this.status = status;
    this.operationOutcome = operationOutcome;
  }
}

async function fhirFetch(path: string, init?: { method?: string; body?: unknown }): Promise<unknown> {
  const response = await fetch(`${FHIR_PREFIX}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Accept: "application/fhir+json",
      ...(init?.body !== undefined ? { "Content-Type": "application/fhir+json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (response.status === 401) {
    window.location.href = "/login";
    throw new FhirRequestError("Authentication required", 401);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new FhirRequestError(`FHIR server returned a non-JSON response (status ${response.status})`, response.status);
  }

  if (!response.ok) {
    const outcome = isOperationOutcome(body) ? body : undefined;
    const diagnostics = outcome?.issue?.[0]?.diagnostics;
    throw new FhirRequestError(diagnostics ?? `FHIR request failed with status ${response.status}`, response.status, outcome);
  }

  return body;
}

function isOperationOutcome(value: unknown): value is fhir4.OperationOutcome {
  return typeof value === "object" && value !== null && (value as { resourceType?: string }).resourceType === "OperationOutcome";
}

function isBundle(value: unknown): value is fhir4.Bundle {
  return typeof value === "object" && value !== null && (value as { resourceType?: string }).resourceType === "Bundle";
}

function extractResourcesFromBundle<T extends fhir4.FhirResource>(bundle: unknown, resourceType: T["resourceType"]): T[] {
  if (!isBundle(bundle) || !Array.isArray(bundle.entry)) {
    return [];
  }

  const resources: T[] = [];
  for (const entry of bundle.entry) {
    const resource = entry?.resource;
    if (resource && resource.resourceType === resourceType) {
      resources.push(resource as T);
    }
  }
  return resources;
}

export async function getPatients(): Promise<fhir4.Patient[]> {
  const bundle = await fhirFetch("/Patient");
  return extractResourcesFromBundle<fhir4.Patient>(bundle, "Patient");
}

export async function searchPatientsByName(name: string): Promise<fhir4.Patient[]> {
  const params = new URLSearchParams({ name });
  const bundle = await fhirFetch(`/Patient?${params.toString()}`);
  return extractResourcesFromBundle<fhir4.Patient>(bundle, "Patient");
}

export async function getPatient(patientId: string): Promise<fhir4.Patient> {
  const resource = await fhirFetch(`/Patient/${encodeURIComponent(patientId)}`);
  return resource as fhir4.Patient;
}

export async function getPatientConditions(patientId: string): Promise<fhir4.Condition[]> {
  const bundle = await fhirFetch(`/Condition?patient=${encodeURIComponent(patientId)}`);
  return extractResourcesFromBundle<fhir4.Condition>(bundle, "Condition").filter(condition =>
    referencesPatient(condition.subject, patientId),
  );
}

export async function getPatientObservations(patientId: string): Promise<fhir4.Observation[]> {
  const bundle = await fhirFetch(`/Observation?patient=${encodeURIComponent(patientId)}`);
  return extractResourcesFromBundle<fhir4.Observation>(bundle, "Observation").filter(observation =>
    referencesPatient(observation.subject, patientId),
  );
}

export async function getPatientMedicationRequests(patientId: string): Promise<fhir4.MedicationRequest[]> {
  const bundle = await fhirFetch(`/MedicationRequest?patient=${encodeURIComponent(patientId)}`);
  return extractResourcesFromBundle<fhir4.MedicationRequest>(bundle, "MedicationRequest").filter(medicationRequest =>
    referencesPatient(medicationRequest.subject, patientId),
  );
}

export async function getPatientDiagnosticReports(patientId: string): Promise<fhir4.DiagnosticReport[]> {
  const bundle = await fhirFetch(`/DiagnosticReport?patient=${encodeURIComponent(patientId)}`);
  return extractResourcesFromBundle<fhir4.DiagnosticReport>(bundle, "DiagnosticReport").filter(report =>
    referencesPatient(report.subject, patientId),
  );
}

export async function getPatientMedicationAdministrations(patientId: string): Promise<fhir4.MedicationAdministration[]> {
  const bundle = await fhirFetch(`/MedicationAdministration?patient=${encodeURIComponent(patientId)}`);
  return extractResourcesFromBundle<fhir4.MedicationAdministration>(bundle, "MedicationAdministration").filter(administration =>
    referencesPatient(administration.subject, patientId),
  );
}

export async function getPatientTasks(patientId: string): Promise<fhir4.Task[]> {
  const bundle = await fhirFetch(`/Task?patient=${encodeURIComponent(patientId)}`);
  return extractResourcesFromBundle<fhir4.Task>(bundle, "Task").filter(task =>
    task.for ? referencesPatient(task.for, patientId) : true,
  );
}

export async function createTask(task: fhir4.Task): Promise<fhir4.Task> {
  const resource = await fhirFetch("/Task", { method: "POST", body: task });
  return resource as fhir4.Task;
}

export { FhirRequestError, referencesPatient };
