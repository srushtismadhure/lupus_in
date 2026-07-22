import type { CareCoordinationPlan, CareCoordinationReferralPreview, CarePathwayType } from "./types.js";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    const error = typeof body === "object" && body !== null && "error" in body ? body.error : undefined;
    throw new Error(typeof error === "string" ? error : "Care-coordination request failed.");
  }
  return body as T;
}

export function getCareCoordinationPlan(patientId: string): Promise<CareCoordinationPlan> {
  return requestJson(`/api/patients/${encodeURIComponent(patientId)}/care-coordination`);
}

export interface ReferralReviewPayload {
  pathwayType: Exclude<CarePathwayType, "generic">;
  coordinatorReference?: string;
  coordinatorDisplay?: string;
  destinationReference?: string;
  destinationDisplay?: string;
  dueDate?: string;
}

export function previewReferral(patientId: string, payload: ReferralReviewPayload): Promise<CareCoordinationReferralPreview> {
  return requestJson(`/api/patients/${encodeURIComponent(patientId)}/care-coordination/referrals/preview`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function confirmReferral(patientId: string, payload: ReferralReviewPayload): Promise<{ ok: true }> {
  return requestJson(`/api/patients/${encodeURIComponent(patientId)}/care-coordination/referrals/confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTask(
  patientId: string,
  taskId: string,
  payload: Record<string, unknown>,
): Promise<fhir4.Task> {
  return requestJson(`/api/patients/${encodeURIComponent(patientId)}/care-coordination/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
