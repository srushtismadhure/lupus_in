import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardPlus,
  ExternalLink,
  FileSearch,
  History,
  RefreshCw,
  SearchCheck,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { CoordinationTimeline } from "@/components/care-coordination/CoordinationTimeline";
import { SleAssessmentDialog } from "@/components/sle-systems-review/SleAssessmentDialog";
import { SleBodyMap } from "@/components/sle-systems-review/SleBodyMap";
import { SystemStatusBadge } from "@/components/sle-systems-review/SystemStatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { approveClinicalConcept, rejectClinicalConcept } from "@/lib/notes-coding-client";
import { createSleTask, getSleSystemsReview, submitSleAssessment } from "@/lib/sle-systems-review/client";
import type { SleEvidenceItem, SleSystemId, SleSystemReview, SleSystemsReviewModel } from "@/lib/sle-systems-review/types";
import { getClinicianWorklist } from "@/lib/worklist-client";
import type { WorklistPatientView } from "@/lib/worklist-types";

function displayDate(value?: string, includeTime = false): string {
  if (!value) return "Not documented";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
}

function EvidenceList({ items, emptyText }: { items: SleEvidenceItem[]; emptyText: string }) {
  if (items.length === 0) return <p className="text-sm text-[#5B6878]">{emptyText}</p>;
  return (
    <ul className="divide-y divide-[#E6ECF2]">
      {items.slice(0, 10).map(item => (
        <li key={item.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1F2430]">{item.title}</p>
              {item.detail && <p className="mt-1 text-xs leading-5 text-[#5B6878]">{item.detail}</p>}
            </div>
            <Badge variant="neutral">{item.resourceType}</Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#697586]">
            <span>{displayDate(item.date)}</span>
            <span>{item.source}</span>
            {item.resourceReference && (
              <a href={`/fhir/${item.resourceReference}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#3F1D63] underline decoration-[#78B7E3] underline-offset-2">
                Review evidence <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SystemsSummary({ systems, selected, onSelect }: { systems: SleSystemReview[]; selected: SleSystemId; onSelect: (id: SleSystemId) => void }) {
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b border-[#E6ECF2] px-4 py-4"><CardTitle className="flex items-center gap-2 text-base"><Stethoscope className="size-4 text-[#65408A]" aria-hidden="true" />Systems summary</CardTitle></CardHeader>
      <CardContent className="p-2">
        <ul className="space-y-1">
          {systems.map(system => (
            <li key={system.id}>
              <button
                type="button"
                onClick={() => onSelect(system.id)}
                aria-current={selected === system.id ? "true" : undefined}
                className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-[#F3F9FD] focus-visible:ring-[3px] focus-visible:ring-[#4F97C8]/40 ${selected === system.id ? "bg-[#F3EFF7]" : ""}`}
              >
                <span className="text-sm font-semibold text-[#1F2430]">{system.title}</span>
                <span className="text-right text-xs text-[#5B6878]">{system.reviewedCount}/{system.totalCount} reviewed</span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function AssessmentCompletenessCard({ model }: { model: SleSystemsReviewModel }) {
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b border-[#E6ECF2] px-4 py-4"><CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="size-4 text-[#245D86]" aria-hidden="true" />Assessment completeness</CardTitle></CardHeader>
      <CardContent className="space-y-3 px-4 py-4">
        <p className="text-2xl font-semibold text-[#1F2430]">{model.assessment.reviewed} <span className="text-sm font-medium text-[#5B6878]">of {model.assessment.total} reviewed</span></p>
        <progress className="h-2 w-full accent-[#65408A]" value={model.assessment.reviewed} max={model.assessment.total} aria-label={model.assessment.label} />
        <p className="text-sm text-[#5B6878]">{model.assessment.documented} of {model.assessment.total} elements have supporting documentation. Documentation does not equal clinician review.</p>
      </CardContent>
    </Card>
  );
}

function OutstandingReviewCard({ model, onSelect }: { model: SleSystemsReviewModel; onSelect: (id: SleSystemId) => void }) {
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b border-[#E6ECF2] px-4 py-4"><CardTitle className="flex items-center gap-2 text-base"><TriangleAlert className="size-4 text-[#9A6418]" aria-hidden="true" />Outstanding review</CardTitle></CardHeader>
      <CardContent className="px-4 py-3">
        {model.outstandingReview.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-[#2F6F47]"><CheckCircle2 className="size-4" aria-hidden="true" />No outstanding structured review items.</p>
        ) : (
          <ul className="divide-y divide-[#E6ECF2]">
            {model.outstandingReview.slice(0, 6).map(item => (
              <li key={item.id}>
                <button type="button" onClick={() => onSelect(item.systemId)} className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-[#4F97C8]/40">
                  <span><strong className="block text-sm text-[#1F2430]">{item.systemTitle}</strong><span className="text-xs text-[#5B6878]">{item.label}</span></span>
                  <ArrowRight className="size-4 shrink-0 text-[#65408A]" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function SleSystemsReviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const patientId = searchParams.get("patientId") ?? "";
  const [patients, setPatients] = useState<WorklistPatientView[]>([]);
  const [model, setModel] = useState<SleSystemsReviewModel | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<SleSystemId>("renal");
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingPatients(true);
    getClinicianWorklist()
      .then(worklist => {
        if (cancelled) return;
        const active = worklist.allPatients.filter(patient => patient.active);
        setPatients(active);
        const currentExists = active.some(patient => patient.patient.id === patientId);
        if (!currentExists) {
          const initial = active.find(patient => patient.hasLupusNephritis) ?? active[0];
          if (initial?.patient.id) setSearchParams({ patientId: initial.patient.id }, { replace: true });
        }
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "The patient list could not be loaded."); })
      .finally(() => { if (!cancelled) setLoadingPatients(false); });
    return () => { cancelled = true; };
  }, [patientId, setSearchParams]);

  const loadReview = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const next = await getSleSystemsReview(patientId);
      setModel(next);
      if (!next.systems.some(system => system.id === selectedSystemId)) setSelectedSystemId("renal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The SLE systems review could not be loaded.");
      setModel(null);
    } finally {
      setLoading(false);
    }
  }, [patientId, selectedSystemId]);

  useEffect(() => {
    let cancelled = false;
    if (!patientId) return;
    setLoading(true);
    setError(null);
    getSleSystemsReview(patientId)
      .then(next => { if (!cancelled) { setModel(next); setSelectedSystemId("renal"); } })
      .catch(err => { if (!cancelled) { setError(err instanceof Error ? err.message : "The SLE systems review could not be loaded."); setModel(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId]);

  const selectedSystem = model?.systems.find(system => system.id === selectedSystemId) ?? model?.systems[0] ?? null;
  const timelineEvents = useMemo(() => {
    if (!selectedSystem) return [];
    return [...selectedSystem.currentEvidence, ...selectedSystem.historicalEvidence]
      .filter(item => item.date)
      .map(item => ({ id: item.id, timestamp: item.date!, title: item.title, detail: `${item.source}${item.detail ? ` - ${item.detail}` : ""}`, resourceReference: item.resourceReference }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [selectedSystem]);

  async function saveAssessment(itemIds: string[], note?: string) {
    if (!patientId || !selectedSystem) return;
    await submitSleAssessment(patientId, selectedSystem.id, itemIds, note);
    toast.success("Structured assessment items saved to FHIR.");
    await loadReview();
  }

  async function createTask() {
    if (!patientId || !selectedSystem) return;
    setBusyAction("task");
    try {
      await createSleTask(patientId, selectedSystem.id);
      toast.success("Follow-up Task created.");
      await loadReview();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The Task could not be created.");
    } finally {
      setBusyAction(null);
    }
  }

  async function decideNote(draftId: string, conceptId: string, decision: "approve" | "reject", candidateId?: string) {
    setBusyAction(`${decision}-${conceptId}`);
    try {
      if (decision === "approve") await approveClinicalConcept(draftId, conceptId, { selectedCandidateId: candidateId });
      else await rejectClinicalConcept(draftId, conceptId, { reason: "Rejected from Structured SLE Systems Review." });
      toast.success(decision === "approve" ? "Concept approved and written to FHIR." : "Concept rejected.");
      await loadReview();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The note concept could not be updated.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <AppShell title="SLE Systems Review" subtitle="Organ-specific lupus assessment, historical involvement, and assessment completeness">
      <div className="space-y-5">
        <section className="flex flex-wrap items-end justify-between gap-4 border-b border-[#DCE6F0] pb-5" aria-labelledby="review-context-heading">
          <div>
            <p className="text-xs font-semibold uppercase text-[#65408A]">Structured SLE Systems Review</p>
            <h2 id="review-context-heading" className="mt-1 text-xl font-semibold text-[#1F2430]">Patient review context</h2>
            <p className="mt-1 text-sm text-[#5B6878]">Systematic assessment support only. No official BILAG grade, risk percentage, or predicted severity is calculated.</p>
          </div>
          <div className="flex min-w-[260px] flex-col gap-1.5">
            <label htmlFor="sle-patient-select" className="text-sm font-semibold text-[#344253]">Patient</label>
            <select
              id="sle-patient-select"
              className="min-h-11 rounded-lg border border-[#BFCFDC] bg-white px-3 text-sm text-[#1F2430] outline-none focus-visible:ring-[3px] focus-visible:ring-[#4F97C8]/40"
              value={patientId}
              disabled={loadingPatients}
              onChange={event => setSearchParams({ patientId: event.target.value })}
            >
              {loadingPatients && <option value="">Loading patients...</option>}
              {!loadingPatients && patients.length === 0 && <option value="">No active patients available</option>}
              {patients.map(patient => <option key={patient.patient.id} value={patient.patient.id}>{patient.name}{patient.primaryConditionText ? ` - ${patient.primaryConditionText}` : ""}</option>)}
            </select>
          </div>
        </section>

        {error && <Alert variant="destructive"><AlertTriangle aria-hidden="true" /><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button variant="outline" size="sm" onClick={loadReview}><RefreshCw aria-hidden="true" />Try again</Button></AlertDescription></Alert>}
        {loading && <div role="status" aria-live="polite" className="rounded-lg border border-[#DCE6F0] bg-white p-6 text-sm text-[#4F5E70]">Loading patient-specific SLE systems evidence...</div>}

        {model && !loading && (
          <>
            <section className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-[#DCE6F0] bg-white px-5 py-4" aria-label="Selected patient">
              <div><h2 className="text-lg font-semibold text-[#1F2430]">{model.patient.name}</h2><p className="mt-1 text-sm text-[#5B6878]">{model.patient.primaryDiagnosis ?? "No lupus diagnosis label was available in the retrieved Conditions."}</p></div>
              <div className="text-sm text-[#5B6878]"><p><strong className="text-[#344253]">Patient identifier:</strong> {model.patient.identifier ?? "Not available"}</p><p className="mt-1"><strong className="text-[#344253]">Review generated:</strong> {displayDate(model.generatedAt, true)}</p></div>
            </section>
            {!model.dataStatus.complete && <Alert variant="warning"><TriangleAlert aria-hidden="true" /><AlertDescription>Some FHIR resource groups could not be retrieved: {model.dataStatus.failedSections.join(", ")}. Missing data are shown as incomplete, not as no concern.</AlertDescription></Alert>}

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.55fr)]">
              <SleBodyMap systems={model.systems} selectedSystemId={selectedSystemId} onSelect={setSelectedSystemId} />
              <aside className="space-y-4" aria-label="SLE systems review summary">
                <SystemsSummary systems={model.systems} selected={selectedSystemId} onSelect={setSelectedSystemId} />
                <AssessmentCompletenessCard model={model} />
                <OutstandingReviewCard model={model} onSelect={setSelectedSystemId} />
              </aside>
            </div>

            {selectedSystem && (
              <section id="selected-organ-detail" className="space-y-5 border-t border-[#CCDCE9] pt-6" aria-labelledby="selected-system-heading">
                <div className={`rounded-lg border bg-white px-5 py-5 ${selectedSystem.permanentDamageDocumented ? "sle-damage-border" : "border-[#DCE6F0]"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0"><p className="text-xs font-semibold uppercase text-[#65408A]">Selected organ detail</p><h2 id="selected-system-heading" className="mt-1 text-xl font-semibold text-[#1F2430]">{selectedSystem.title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-[#5B6878]">{selectedSystem.description}</p></div>
                    <SystemStatusBadge status={selectedSystem.status} label={selectedSystem.statusLabel} />
                  </div>
                  <p className="mt-3 text-sm text-[#344253]">{selectedSystem.statusDetail}</p>
                  <dl className="mt-4 grid gap-3 border-t border-[#E6ECF2] pt-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="text-xs font-semibold uppercase text-[#697586]">Assessment</dt><dd className="mt-1 text-sm font-semibold text-[#1F2430]">{selectedSystem.completenessLabel}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-[#697586]">Evidence</dt><dd className="mt-1 text-sm font-semibold text-[#1F2430]">{selectedSystem.evidenceCompletionLabel}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-[#697586]">Historical involvement</dt><dd className="mt-1 text-sm font-semibold text-[#1F2430]">{selectedSystem.historicalEvidence.length > 0 ? `${selectedSystem.historicalEvidence.length} item${selectedSystem.historicalEvidence.length === 1 ? "" : "s"}` : "None documented"}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase text-[#697586]">Last updated</dt><dd className="mt-1 text-sm font-semibold text-[#1F2430]">{displayDate(selectedSystem.lastUpdated)}</dd></div>
                  </dl>
                  {selectedSystem.permanentDamageDocumented && <p className="mt-3 text-sm font-semibold text-[#5B3A72]">Chronic or permanent damage is explicitly documented in the available evidence.</p>}
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Card className="gap-0 p-0"><CardHeader className="border-b border-[#E6ECF2] px-5 py-4"><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4 text-[#65408A]" aria-hidden="true" />Current evidence</CardTitle></CardHeader><CardContent className="px-5 py-4"><EvidenceList items={selectedSystem.currentEvidence} emptyText="No current system-specific evidence is available." /></CardContent></Card>
                  <Card className="gap-0 p-0"><CardHeader className="border-b border-[#E6ECF2] px-5 py-4"><CardTitle className="flex items-center gap-2 text-base"><History className="size-4 text-[#245D86]" aria-hidden="true" />Historical involvement</CardTitle></CardHeader><CardContent className="px-5 py-4"><EvidenceList items={selectedSystem.historicalEvidence} emptyText="No historical system-specific evidence is available." /></CardContent></Card>
                </div>

                {selectedSystem.pendingNoteConcepts.length > 0 && (
                  <Card className="gap-0 border-[#E4DAEC] p-0"><CardHeader className="border-b border-[#E4DAEC] px-5 py-4"><CardTitle className="flex items-center gap-2 text-base"><FileSearch className="size-4 text-[#65408A]" aria-hidden="true" />Notes & Coding concepts awaiting review</CardTitle></CardHeader><CardContent className="space-y-3 px-5 py-4">
                    {selectedSystem.pendingNoteConcepts.map(concept => (
                      <div key={concept.id} className="rounded-lg border border-[#DCE6F0] bg-[#F8FAFD] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#1F2430]">{concept.label}</p><p className="mt-1 text-sm text-[#5B6878]">Source phrase: “{concept.sourceText}”</p><p className="mt-1 text-xs text-[#697586]">{displayDate(concept.noteDate)} · {concept.certainty}</p></div><Badge variant="warning">Awaiting clinician review</Badge></div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => decideNote(concept.draftId, concept.conceptId, "approve", concept.validatedCandidateId)} disabled={!concept.validatedCandidateId || busyAction === `approve-${concept.conceptId}`}><CheckCircle2 aria-hidden="true" />Approve finding</Button>
                          <Button size="sm" variant="outline" onClick={() => decideNote(concept.draftId, concept.conceptId, "reject")} disabled={busyAction === `reject-${concept.conceptId}`}>Reject</Button>
                          <Button asChild size="sm" variant="link"><Link to={`/patients/${model.patient.id}/notes-coding`}><ExternalLink aria-hidden="true" />Open Notes & Coding</Link></Button>
                        </div>
                        {!concept.validatedCandidateId && <p className="mt-2 text-xs text-[#8A641F]">Approval requires a validated terminology candidate. Open Notes & Coding to review terminology.</p>}
                      </div>
                    ))}
                  </CardContent></Card>
                )}

                <CoordinationTimeline events={timelineEvents} title="FHIR evidence timeline" emptyText="No dated evidence is available for this system." showResourceLinks />

                <div className="grid gap-5 lg:grid-cols-2">
                  <Card className="gap-0 p-0"><CardHeader className="border-b border-[#E6ECF2] px-5 py-4"><CardTitle className="flex items-center gap-2 text-base"><SearchCheck className="size-4 text-[#9A6418]" aria-hidden="true" />Missing assessment checklist</CardTitle></CardHeader><CardContent className="px-5 py-4">
                    <ul className="space-y-2">
                      {selectedSystem.checklist.map(item => (
                        <li key={item.id} className="flex min-h-10 items-center gap-2 text-sm text-[#344253]">
                          {item.state === "reviewed" ? <CheckCircle2 className="size-4 shrink-0 text-[#2F7A4C]" aria-hidden="true" /> : <TriangleAlert className="size-4 shrink-0 text-[#9A6418]" aria-hidden="true" />}
                          <span>{item.label}</span>
                          <Badge variant={item.state === "reviewed" ? "success" : item.state === "documented" ? "info" : "warning"} className="ml-auto">{item.state === "reviewed" ? "Reviewed" : item.state === "documented" ? "Documented, not reviewed" : "Missing"}</Badge>
                        </li>
                      ))}
                    </ul>
                  </CardContent></Card>
                  <Card className="gap-0 p-0"><CardHeader className="border-b border-[#E6ECF2] px-5 py-4"><CardTitle className="flex items-center gap-2 text-base"><ClipboardPlus className="size-4 text-[#65408A]" aria-hidden="true" />Recommended next actions</CardTitle></CardHeader><CardContent className="space-y-4 px-5 py-4">
                    <ul className="space-y-2">{selectedSystem.nextActions.map(action => <li key={action} className="flex gap-2 text-sm text-[#344253]"><ArrowRight className="mt-0.5 size-4 shrink-0 text-[#65408A]" aria-hidden="true" />{action}</li>)}</ul>
                    <div className="flex flex-wrap gap-2 border-t border-[#E6ECF2] pt-4">
                      <Button type="button" onClick={() => setAssessmentOpen(true)}><ClipboardCheck aria-hidden="true" />Complete assessment</Button>
                      <Button type="button" variant="outline" onClick={createTask} disabled={busyAction === "task"}><ClipboardPlus aria-hidden="true" />{busyAction === "task" ? "Creating..." : "Create follow-up Task"}</Button>
                      {selectedSystem.id === "renal" && <Button asChild variant="outline"><Link to={`/patients/${model.patient.id}/renal-timeline`}><Activity aria-hidden="true" />Open Renal Timeline</Link></Button>}
                      <Button asChild variant="outline"><Link to={`/patients/${model.patient.id}/care-coordination`}><Stethoscope aria-hidden="true" />Care Coordination</Link></Button>
                    </div>
                    <p className="text-xs leading-5 text-[#697586]">Actions open a review workflow or create a Task. This page never places a laboratory, medication, referral, or treatment order automatically.</p>
                  </CardContent></Card>
                </div>
                <SleAssessmentDialog open={assessmentOpen} onOpenChange={setAssessmentOpen} system={selectedSystem} onSubmit={saveAssessment} />
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
