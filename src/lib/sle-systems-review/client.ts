import type { SleSystemId, SleSystemsReviewModel } from "./types.js";

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(path, {
    method: init?.method ?? "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (response.status === 401) window.location.assign("/login");
  if (!response.ok) throw new Error(body?.error ?? "The SLE systems review request failed.");
  return body as T;
}

export function getSleSystemsReview(patientId: string): Promise<SleSystemsReviewModel> {
  return request(`/api/patients/${encodeURIComponent(patientId)}/sle-systems-review`);
}

export function submitSleAssessment(patientId: string, systemId: SleSystemId, reviewedItemIds: string[], note?: string) {
  return request<{ ok: true; questionnaireResponseId?: string }>(
    `/api/patients/${encodeURIComponent(patientId)}/sle-systems-review/assessments`,
    { method: "POST", body: { systemId, reviewedItemIds, note } },
  );
}

export function createSleTask(patientId: string, systemId: SleSystemId, description?: string) {
  return request<{ taskId: string }>(`/api/patients/${encodeURIComponent(patientId)}/sle-systems-review/tasks`, {
    method: "POST",
    body: { systemId, description },
  });
}

