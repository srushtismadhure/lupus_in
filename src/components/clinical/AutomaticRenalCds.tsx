import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CdsCard } from "@/components/clinical/CdsCard";
import { runAutomaticRenalAssessment, type RunAssessmentResult } from "@/lib/renal-cds-client";

type AssessmentState = "idle" | "discovering" | "evaluating" | "complete" | "error";

interface AutomaticRenalCdsProps {
  patientId: string;
  userId?: string;
}

/**
 * Automatically invokes the luppedin-patient-view CDS service when a clinician opens
 * a patient chart — mirroring how a real EHR (Epic, Cerner, etc.) CDS Client would fire
 * a patient-view hook on chart open. In this demo, the Waypoint frontend plays that CDS
 * Client role; no EHR is actually connected or triggering anything.
 */
export function AutomaticRenalCds({ patientId, userId }: AutomaticRenalCdsProps) {
  const [state, setState] = useState<AssessmentState>("idle");
  const [result, setResult] = useState<RunAssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissedUuids, setDismissedUuids] = useState<Set<string>>(new Set());
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!patientId) {
      setState("idle");
      setResult(null);
      setError(null);
      setDismissedUuids(new Set());
      setEvidenceOpen(false);
      return;
    }

    let cancelled = false;

    setState("discovering");
    setResult(null);
    setError(null);
    setDismissedUuids(new Set());
    setEvidenceOpen(false);

    async function run() {
      try {
        setState("evaluating");
        const assessment = await runAutomaticRenalAssessment(patientId, userId);
        if (cancelled) return;
        setResult(assessment);
        setState("complete");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "The automatic renal CDS assessment failed.");
        setState("error");
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [patientId, userId, retryNonce]);

  const cards = (result?.response.cards ?? []).filter(c => !dismissedUuids.has(c.uuid));

  return (
    <Card className="mb-6 border-[var(--info-border)]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Waypoint Clinical CDS — automatic patient-view simulation</CardTitle>
          <Badge variant="purple">Simulated CDS Client</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-[#8592A3]">
          This panel simulates the CDS Hooks patient-view flow: on chart open, a CDS Client (here, the Waypoint
          frontend) automatically calls the Waypoint CDS service, which evaluates real FHIR data from Medblocks and
          returns cards. No EHR such as Epic or Cerner is connected in this demo — a production deployment would
          have Epic/Cerner play the CDS Client role instead of this frontend.
        </p>

        {(state === "discovering" || state === "evaluating") && (
          <p className="text-sm text-[color:var(--muted-foreground)]">Evaluating renal monitoring…</p>
        )}

        {state === "error" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#F2CBD1] bg-[#FCEBED] px-3 py-2">
            <p className="text-sm font-medium text-[#983344]">{error}</p>
            <Button size="sm" variant="outline" onClick={() => setRetryNonce(n => n + 1)}>
              Retry CDS assessment
            </Button>
          </div>
        )}

        {state === "complete" && cards.length === 0 && (
          <p className="text-sm text-[color:var(--muted-foreground)]">No actionable renal monitoring concerns identified.</p>
        )}

        {state === "complete" && cards.length > 0 && (
          <div className="space-y-3">
            {cards.map(card => (
              <CdsCard key={card.uuid} card={card} onDismiss={uuid => setDismissedUuids(prev => new Set(prev).add(uuid))} />
            ))}
          </div>
        )}

        {result && (
          <div className="border-t border-[var(--muted)] pt-3">
            <button
              type="button"
              onClick={() => setEvidenceOpen(v => !v)}
              className="flex items-center gap-1 text-xs font-medium text-[color:var(--brand)]"
              aria-expanded={evidenceOpen}
            >
              {evidenceOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              CDS Developer Evidence
            </button>
            {evidenceOpen && (
              <div className="mt-3 space-y-3 text-xs text-[color:var(--muted-foreground)]">
                <div>
                  <p className="font-semibold text-[color:var(--foreground)]">Discovery</p>
                  <p>Service: {result.discovery.services.find(s => s.hook === "patient-view")?.id ?? "unknown"}</p>
                </div>
                <div>
                  <p className="font-semibold text-[color:var(--foreground)]">Request</p>
                  <p>hook: {result.request.hook}</p>
                  <p>hookInstance: {result.request.hookInstance}</p>
                  <p>context.patientId: {result.request.context.patientId}</p>
                  <p>context.userId: {result.request.context.userId ?? "—"}</p>
                </div>
                <div>
                  <p className="font-semibold text-[color:var(--foreground)]">Resource counts</p>
                  <p>
                    Conditions: {result.response.debug.conditionCount} · Observations: {result.response.debug.observationCount} ·
                    Tasks: {result.response.debug.taskCount}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-[color:var(--foreground)]">Normalized measurements</p>
                  {result.response.debug.normalized.measurements.length === 0 ? (
                    <p>None</p>
                  ) : (
                    <ul className="list-disc pl-4">
                      {result.response.debug.normalized.measurements.map((m, i) => (
                        <li key={`${m.type}-${m.date}-${i}`}>
                          {m.type.toUpperCase()}: {m.value} {m.unit} ({m.date})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-[color:var(--foreground)]">Rules fired</p>
                  <p>{result.response.debug.firedRuleIds.length > 0 ? result.response.debug.firedRuleIds.join(", ") : "None"}</p>
                  <p>Rule version: {result.response.debug.ruleVersion}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
