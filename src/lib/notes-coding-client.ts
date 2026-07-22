import type {
  AnalyzeClinicalNoteInput,
  ApproveConceptInput,
  ClinicalNoteAnalysisResponse,
  ClinicalNoteDraftView,
  ConceptDecisionResponse,
  CreatePriorAuthTaskInput,
  PriorAuthReadiness,
  RejectConceptInput,
  SaveClinicalNoteInput,
  SdohReferralDraftInput,
  SdohReferralDraftResponse,
} from "./notes-coding-types";

async function apiFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(path, {
    method: init?.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((body as { error?: string } | null)?.error ?? `Request failed with status ${response.status}`);
  }
  return body as T;
}

export function createClinicalNoteDraft(patientId: string, input: SaveClinicalNoteInput) {
  return apiFetch<ClinicalNoteDraftView>(`/api/patients/${encodeURIComponent(patientId)}/clinical-notes/drafts`, {
    method: "POST",
    body: input,
  });
}

export function saveClinicalNoteDraft(draftId: string, input: SaveClinicalNoteInput) {
  return apiFetch<ClinicalNoteDraftView>(`/api/clinical-notes/${encodeURIComponent(draftId)}/save`, {
    method: "POST",
    body: input,
  });
}

export function analyzeClinicalNote(patientId: string, input: AnalyzeClinicalNoteInput) {
  return apiFetch<ClinicalNoteAnalysisResponse>(`/api/patients/${encodeURIComponent(patientId)}/clinical-notes/analyze`, {
    method: "POST",
    body: input,
  });
}

export function approveClinicalConcept(draftId: string, conceptId: string, input: ApproveConceptInput) {
  return apiFetch<ConceptDecisionResponse>(
    `/api/clinical-notes/${encodeURIComponent(draftId)}/concepts/${encodeURIComponent(conceptId)}/approve`,
    { method: "POST", body: input },
  );
}

export function rejectClinicalConcept(draftId: string, conceptId: string, input: RejectConceptInput) {
  return apiFetch<ConceptDecisionResponse>(
    `/api/clinical-notes/${encodeURIComponent(draftId)}/concepts/${encodeURIComponent(conceptId)}/reject`,
    { method: "POST", body: input },
  );
}

export function finalizeClinicalNote(draftId: string) {
  return apiFetch<ClinicalNoteDraftView>(`/api/clinical-notes/${encodeURIComponent(draftId)}/finalize`, { method: "POST" });
}

export function getPriorAuthReadiness(patientId: string, draftId?: string) {
  const params = draftId ? `?draftId=${encodeURIComponent(draftId)}` : "";
  return apiFetch<PriorAuthReadiness>(`/api/patients/${encodeURIComponent(patientId)}/prior-auth-readiness${params}`);
}

export function confirmPriorAuthEvidence(patientId: string, draftId: string, rationale: string) {
  return apiFetch<{ ok: true; readiness: PriorAuthReadiness; rationale?: string }>(
    `/api/patients/${encodeURIComponent(patientId)}/prior-auth/evidence/confirm`,
    { method: "POST", body: { draftId, rationale } },
  );
}

export function createPriorAuthTask(patientId: string, input: CreatePriorAuthTaskInput) {
  return apiFetch<{ taskId: string }>(`/api/patients/${encodeURIComponent(patientId)}/prior-auth/tasks`, {
    method: "POST",
    body: input,
  });
}

export function createSdohReferralDraft(patientId: string, input: SdohReferralDraftInput) {
  return apiFetch<SdohReferralDraftResponse>(`/api/patients/${encodeURIComponent(patientId)}/sdoh/referral-drafts`, {
    method: "POST",
    body: input,
  });
}

export function approveSdohReferralDraft(referralDraftId: string, createFollowUpTask: boolean) {
  return apiFetch<{ ok: true; referral: SdohReferralDraftResponse; taskId?: string }>(
    `/api/referral-drafts/${encodeURIComponent(referralDraftId)}/approve`,
    { method: "POST", body: { createFollowUpTask } },
  );
}

export function cancelSdohReferralDraft(referralDraftId: string) {
  return apiFetch<{ ok: true }>(`/api/referral-drafts/${encodeURIComponent(referralDraftId)}/cancel`, { method: "POST" });
}
