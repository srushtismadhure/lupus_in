import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Stethoscope } from "lucide-react";
import { useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PatientSubNav } from "@/components/patients/PatientSubNav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AppointmentsPanel } from "@/components/care-coordination/AppointmentsPanel";
import { BarriersPanel } from "@/components/care-coordination/BarriersPanel";
import { CareCoordinationSummary } from "@/components/care-coordination/CareCoordinationSummary";
import { CareTeamPanel } from "@/components/care-coordination/CareTeamPanel";
import { ClinicianReviewDialog } from "@/components/care-coordination/ClinicianReviewDialog";
import { CoordinationTimeline } from "@/components/care-coordination/CoordinationTimeline";
import { PathwayCard } from "@/components/care-coordination/PathwayCard";
import { getCareCoordinationPlan } from "@/lib/care-coordination/client";
import type { CareCoordinationPlan, CarePathway } from "@/lib/care-coordination/types";

function dateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function CareCoordinationPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [model, setModel] = useState<CareCoordinationPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewPathway, setReviewPathway] = useState<CarePathway | null>(null);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      setModel(await getCareCoordinationPlan(patientId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Care-coordination data could not be retrieved.");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <AppShell title="Care Coordination" subtitle="Closed-loop renal referrals, ownership, scheduling, and follow-up">
      {patientId && <PatientSubNav patientId={patientId} />}

      {loading && <p role="status" aria-live="polite" className="rounded-lg border border-[var(--border)] bg-white p-6 text-sm text-[color:var(--muted-foreground)]">Loading patient-specific care-coordination data...</p>}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={load}><RefreshCw className="size-4" aria-hidden="true" /> Try again</Button>
          </AlertDescription>
        </Alert>
      )}

      {model && !loading && (
        <div className="space-y-5">
          <section className="rounded-lg border border-[var(--border)] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(31,36,48,0.05)]" aria-labelledby="coordination-patient-heading">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase text-[color:var(--primary)]"><Stethoscope className="size-4" aria-hidden="true" /> Patient care coordination</p>
                <h2 id="coordination-patient-heading" className="mt-2 text-xl font-semibold text-[color:var(--foreground)]">{model.patientName}</h2>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{model.primaryRenalDiagnosis ?? "Primary renal diagnosis not available"}</p>
              </div>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="text-[color:var(--muted-foreground)]">Coordinator</dt><dd className="font-semibold text-[color:var(--foreground)]">{model.assignedCoordinator}</dd></div>
                <div><dt className="text-[color:var(--muted-foreground)]">Last updated</dt><dd className="font-semibold text-[color:var(--foreground)]">{dateTime(model.lastUpdatedAt)}</dd></div>
                {model.patientIdentifier && <div><dt className="text-[color:var(--muted-foreground)]">Patient identifier</dt><dd className="font-semibold text-[color:var(--foreground)]">{model.patientIdentifier}</dd></div>}
                <div><dt className="text-[color:var(--muted-foreground)]">Care plan</dt><dd className="font-semibold capitalize text-[color:var(--foreground)]">{model.status.replace("-", " ")}</dd></div>
              </dl>
            </div>
          </section>

          <CareCoordinationSummary summary={model.summary} />

          {!model.dataStatus.complete && (
            <Alert variant="warning"><AlertDescription>Some coordination data could not be retrieved: {model.dataStatus.failedSections.join(", ")}. Missing information is not treated as no concern.</AlertDescription></Alert>
          )}
          {model.dataStatus.insufficientEvidence.length > 0 && (
            <Alert><AlertDescription>{model.dataStatus.insufficientEvidence.join(" ")}</AlertDescription></Alert>
          )}

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section aria-labelledby="active-pathways-heading" className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 id="active-pathways-heading" className="text-lg font-semibold text-[color:var(--foreground)]">Patient pathways</h2>
                <Button type="button" variant="outline" size="sm" onClick={load}><RefreshCw className="size-4" aria-hidden="true" /> Refresh</Button>
              </div>
              {model.pathways.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--input)] bg-white p-8 text-center text-sm text-[color:var(--muted-foreground)]">No active care-coordination gaps were identified.</div>
              ) : model.pathways.map(pathway => <PathwayCard key={pathway.id} pathway={pathway} onReview={setReviewPathway} />)}
            </section>
            <aside aria-label="Care coordination supporting information" className="space-y-4">
              <CareTeamPanel members={model.careTeam} />
              <AppointmentsPanel appointments={model.upcomingAppointments} />
              <BarriersPanel barriers={model.barriers} />
            </aside>
          </div>

          <CoordinationTimeline events={model.timeline} />
        </div>
      )}

      {patientId && (
        <ClinicianReviewDialog
          open={Boolean(reviewPathway)}
          onOpenChange={open => { if (!open) setReviewPathway(null); }}
          patientId={patientId}
          pathway={reviewPathway}
          onSubmitted={load}
        />
      )}
    </AppShell>
  );
}

