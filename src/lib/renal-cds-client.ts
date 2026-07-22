/**
 * Browser-side CDS Hooks client for the automatic renal-monitoring workflow.
 * This is the "temporary CDS Client" role — it only discovers the service,
 * sends the request, and hands back the response. All clinical evaluation
 * happens server-side (see src/lib/cds-hooks.ts / renal-cds-rules.ts).
 */
import type { RenalCdsCard } from "./renal-cds-card";
import type { NormalizedRenalData } from "./renal-cds-normalize";
import type { RenalRuleId } from "./renal-cds-rules";

export interface CdsServiceDescriptor {
  id: string;
  hook: string;
  title: string;
  description: string;
  usageRequirements?: string;
}

export interface CdsDiscoveryResponse {
  services: CdsServiceDescriptor[];
}

export async function discoverCdsServices(): Promise<CdsDiscoveryResponse> {
  const response = await fetch("/cds-services");
  if (!response.ok) throw new Error(`CDS discovery failed (status ${response.status}).`);
  return (await response.json()) as CdsDiscoveryResponse;
}

export interface RenalPatientViewResponse {
  cards: RenalCdsCard[];
  debug: {
    conditionCount: number;
    observationCount: number;
    taskCount: number;
    normalized: NormalizedRenalData;
    firedRuleIds: RenalRuleId[];
    ruleVersion: string;
  };
}

export interface RunAssessmentResult {
  discovery: CdsDiscoveryResponse;
  request: { hook: string; hookInstance: string; context: { userId?: string; patientId: string } };
  response: RenalPatientViewResponse;
}

const PATIENT_VIEW_SERVICE_ID = "luppedin-patient-view";

export async function runAutomaticRenalAssessment(patientId: string, userId?: string): Promise<RunAssessmentResult> {
  const discovery = await discoverCdsServices();
  const service = discovery.services.find(s => s.id === PATIENT_VIEW_SERVICE_ID && s.hook === "patient-view");
  if (!service) throw new Error("The luppedin-patient-view CDS service is not available.");

  const request = {
    hook: "patient-view" as const,
    hookInstance: crypto.randomUUID(),
    context: { userId, patientId },
  };

  const response = await fetch(`/cds-services/${service.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error((body as { error?: string })?.error ?? `Renal CDS assessment failed (status ${response.status}).`);
  }

  return { discovery, request, response: (await response.json()) as RenalPatientViewResponse };
}
