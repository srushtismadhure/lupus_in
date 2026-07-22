import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PathwayEvidence } from "./PathwayEvidence";
import { confirmReferral, previewReferral, type ReferralReviewPayload } from "@/lib/care-coordination/client";
import type { CareCoordinationReferralPreview, CarePathway } from "@/lib/care-coordination/types";
import { useAuth } from "@/components/auth/AuthProvider";

export function ClinicianReviewDialog({
  open,
  onOpenChange,
  patientId,
  pathway,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  pathway: CarePathway | null;
  onSubmitted: () => void;
}) {
  const { user } = useAuth();
  const [coordinatorDisplay, setCoordinatorDisplay] = useState("");
  const [destinationDisplay, setDestinationDisplay] = useState("");
  const [destinationReference, setDestinationReference] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [preview, setPreview] = useState<CareCoordinationReferralPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCoordinatorDisplay("");
    setDestinationDisplay(pathway?.pathwayType === "medical-nutrition-therapy" ? "Unassigned renal dietitian service" : "");
    setDestinationReference("");
    setDueDate("");
    setPreview(null);
    setConfirmed(false);
    setError(null);
  }, [open, pathway]);

  const payload = useMemo<ReferralReviewPayload | null>(() => {
    if (!pathway || pathway.pathwayType === "generic") return null;
    return {
      pathwayType: pathway.pathwayType,
      coordinatorDisplay: coordinatorDisplay || undefined,
      destinationDisplay: destinationDisplay || undefined,
      destinationReference: destinationReference || undefined,
      dueDate: dueDate ? new Date(`${dueDate}T17:00:00`).toISOString() : undefined,
    };
  }, [coordinatorDisplay, destinationDisplay, destinationReference, dueDate, pathway]);

  async function createPreview() {
    if (!payload) return;
    setWorking(true);
    setError(null);
    try {
      setPreview(await previewReferral(patientId, payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to prepare referral preview.");
    } finally {
      setWorking(false);
    }
  }

  async function submit() {
    if (!payload || !confirmed || user?.role !== "clinician") return;
    setWorking(true);
    setError(null);
    try {
      await confirmReferral(patientId, payload);
      toast.success("Referral and coordination Task confirmed by the FHIR server.");
      onOpenChange(false);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit the referral.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review and refer</DialogTitle>
          <DialogDescription>Review the evidence and draft resources. Nothing is submitted until an authorized clinician confirms.</DialogDescription>
        </DialogHeader>
        {pathway && (
          <div className="space-y-5">
            <section aria-labelledby="referral-reason-heading" className="rounded-lg border border-[#DCE6F0] bg-[#F8FAFD] p-4">
              <h3 id="referral-reason-heading" className="font-semibold text-[#1F2430]">{pathway.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#4F5E70]">{pathway.reason}</p>
              <div className="mt-3"><PathwayEvidence evidence={pathway.evidence} ruleId={pathway.sourceRuleId} ruleVersion={pathway.ruleVersion} /></div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="coordination-owner">Coordinator</Label>
                <Input id="coordination-owner" value={coordinatorDisplay} onChange={event => { setCoordinatorDisplay(event.target.value); setPreview(null); }} placeholder="Leave blank to mark Unassigned" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coordination-due">Coordination due date</Label>
                <Input id="coordination-due" type="date" value={dueDate} onChange={event => { setDueDate(event.target.value); setPreview(null); }} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination-name">Destination service</Label>
                <Input id="destination-name" value={destinationDisplay} onChange={event => { setDestinationDisplay(event.target.value); setPreview(null); }} placeholder="Select or name a service" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination-reference">FHIR destination reference</Label>
                <Input id="destination-reference" value={destinationReference} onChange={event => { setDestinationReference(event.target.value); setPreview(null); }} placeholder="HealthcareService/... or Organization/..." />
              </div>
            </div>

            {(pathway.pathwayType === "kidney-transplant-evaluation" || pathway.pathwayType === "dialysis-planning") && (
              <Button asChild variant="outline" className="min-h-11">
                <a href={`/kidney-services?tab=${pathway.pathwayType === "kidney-transplant-evaluation" ? "transplant" : "dialysis"}&patientId=${encodeURIComponent(patientId)}`}>
                  <Building2 className="size-4" aria-hidden="true" />
                  Compare {pathway.pathwayType === "kidney-transplant-evaluation" ? "transplant centers" : "dialysis facilities"}
                </a>
              </Button>
            )}

            {!preview ? (
              <Button type="button" onClick={createPreview} disabled={working} className="min-h-11">
                {working ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ClipboardCheck className="size-4" aria-hidden="true" />}
                Generate referral preview
              </Button>
            ) : (
              <section aria-labelledby="fhir-preview-heading" className="rounded-lg border border-[#B7D9EF] bg-[#F3F9FD] p-4">
                <h3 id="fhir-preview-heading" className="flex items-center gap-2 font-semibold text-[#1F2430]"><CheckCircle2 className="size-4 text-[#2F7A4C]" aria-hidden="true" /> Draft resources ready</h3>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-[#4F5E70]">ServiceRequest</dt><dd className="font-semibold">{preview.serviceRequest.status} · {preview.serviceRequest.intent}</dd></div>
                  <div><dt className="text-[#4F5E70]">Task</dt><dd className="font-semibold">{preview.task.status} · {preview.task.owner?.display ?? "Unassigned"}</dd></div>
                  <div><dt className="text-[#4F5E70]">CarePlan</dt><dd className="font-semibold">{preview.carePlan.status}</dd></div>
                  <div><dt className="text-[#4F5E70]">CareTeam</dt><dd className="font-semibold">{preview.careTeam.status}</dd></div>
                </dl>
                <details className="mt-3 text-xs text-[#4F5E70]">
                  <summary className="min-h-9 cursor-pointer font-semibold text-[#3F1D63]">FHIR transaction details</summary>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-white p-3">{JSON.stringify(preview.transaction, null, 2)}</pre>
                </details>
              </section>
            )}

            {preview && user?.role === "clinician" && (
              <label className="flex min-h-11 items-start gap-3 rounded-lg border border-[#DCE6F0] p-3 text-sm font-medium text-[#1F2430]">
                <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-0.5 size-5 accent-[#43205F]" />
                I reviewed the clinical evidence, destination, owner, and draft resources and authorize this referral order.
              </label>
            )}
            {preview && user?.role !== "clinician" && <p className="rounded-lg bg-[#FFF4DD] p-3 text-sm font-medium text-[#805110]">Only an authorized clinician can submit this referral.</p>}
            {error && <p role="alert" className="rounded-lg bg-[#FCEBED] p-3 text-sm font-medium text-[#8B2D3B]">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={!preview || !confirmed || working || user?.role !== "clinician"}>
            {working && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Confirm and submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

