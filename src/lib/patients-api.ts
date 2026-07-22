import type { PatientFormInput } from "./patient-input";

export interface PatientApiResult {
  ok: boolean;
  status: number;
  patient?: fhir4.Patient;
  operationOutcome?: fhir4.OperationOutcome;
  errorMessage?: string;
}

function isOperationOutcome(value: unknown): value is fhir4.OperationOutcome {
  return typeof value === "object" && value !== null && (value as { resourceType?: string }).resourceType === "OperationOutcome";
}

async function parseResult(response: Response): Promise<PatientApiResult> {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const outcome = isOperationOutcome(body) ? body : undefined;
    return {
      ok: false,
      status: response.status,
      operationOutcome: outcome,
      errorMessage: outcome?.issue?.[0]?.diagnostics ?? (body as { error?: string })?.error ?? "Request failed",
    };
  }

  return { ok: true, status: response.status, patient: body as fhir4.Patient };
}

export async function createPatient(input: PatientFormInput): Promise<PatientApiResult> {
  const response = await fetch("/api/patients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResult(response);
}

export async function updatePatient(patientId: string, input: PatientFormInput, etag?: string): Promise<PatientApiResult> {
  const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(etag ? { "If-Match": etag } : {}),
    },
    body: JSON.stringify(input),
  });
  return parseResult(response);
}

export async function deactivatePatient(patientId: string): Promise<PatientApiResult> {
  const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/deactivate`, { method: "POST" });
  return parseResult(response);
}
