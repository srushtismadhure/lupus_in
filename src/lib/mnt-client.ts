import type { MntPatientState, MntReferralView, MntWorklistResponse, PatientWillingness } from "./mnt-types.js";

async function mntFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(path, {
    method: init?.method ?? "GET",
    credentials: "include",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Authentication required");
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((body as { error?: string })?.error ?? "The request could not be completed.");
  }
  return body as T;
}

export function getPatientMntState(patientId: string): Promise<MntPatientState> {
  return mntFetch(`/api/mnt/patients/${encodeURIComponent(patientId)}`);
}

export function getNurseMntWorklist(): Promise<MntWorklistResponse> {
  return mntFetch("/api/nurse/mnt-worklist");
}

export interface PrepareReferralInput {
  patientId: string;
  reasonDisplay: string;
  reasonReferenceId?: string;
  reasonReferenceType?: "Condition" | "Observation";
  supportingObservationIds?: string[];
  willingness: PatientWillingness;
  barriers: string[];
}

export function prepareReferral(input: PrepareReferralInput): Promise<MntReferralView> {
  return mntFetch("/api/mnt/referrals", { method: "POST", body: input });
}

export function sendForSignature(serviceRequestId: string): Promise<MntReferralView> {
  return mntFetch(`/api/mnt/referrals/${encodeURIComponent(serviceRequestId)}/send-for-signature`, { method: "POST", body: {} });
}

export function signReferral(serviceRequestId: string, dietitianDisplay?: string): Promise<MntReferralView> {
  return mntFetch(`/api/mnt/referrals/${encodeURIComponent(serviceRequestId)}/sign`, { method: "POST", body: { dietitianDisplay } });
}

export function declineReferral(serviceRequestId: string, reason: string): Promise<MntReferralView> {
  return mntFetch(`/api/mnt/referrals/${encodeURIComponent(serviceRequestId)}/decline`, { method: "POST", body: { reason } });
}

export function modifyReferral(serviceRequestId: string, reasonText: string): Promise<MntReferralView> {
  return mntFetch(`/api/mnt/referrals/${encodeURIComponent(serviceRequestId)}/modify`, { method: "POST", body: { reasonText } });
}

export function documentBarrier(serviceRequestId: string, barrier: string): Promise<MntReferralView> {
  return mntFetch(`/api/mnt/referrals/${encodeURIComponent(serviceRequestId)}/barrier`, { method: "POST", body: { barrier } });
}

export function contactPatient(
  serviceRequestId: string,
  outcome: "reached" | "no-response" | "declined-appointment",
  note?: string,
): Promise<MntReferralView> {
  return mntFetch(`/api/mnt/referrals/${encodeURIComponent(serviceRequestId)}/contact`, { method: "POST", body: { outcome, note } });
}

export function coordinateScheduling(
  serviceRequestId: string,
  appointmentDate?: string,
  dietitianDisplay?: string,
): Promise<MntReferralView> {
  return mntFetch(`/api/mnt/referrals/${encodeURIComponent(serviceRequestId)}/schedule`, {
    method: "POST",
    body: { appointmentDate, dietitianDisplay },
  });
}
