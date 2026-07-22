import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ClipboardList, FileSearch, RotateCcw, Save, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { PatientHeader } from "@/components/patients/PatientHeader";
import { PatientSubNav } from "@/components/patients/PatientSubNav";
import { CreateTaskDialog } from "@/components/clinical/CreateTaskDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPatient, getPatientConditions } from "@/lib/fhir";
import { formatPatientName } from "@/lib/formatters";
import {
  analyzeClinicalNote,
  approveClinicalConcept,
  confirmPriorAuthEvidence,
  createClinicalNoteDraft,
  createPriorAuthTask,
  createSdohReferralDraft,
  finalizeClinicalNote,
  getPriorAuthReadiness,
  rejectClinicalConcept,
  saveClinicalNoteDraft,
} from "@/lib/notes-coding-client";
import type {
  ClinicalConceptCategory,
  ClinicalConceptSuggestion,
  ClinicalNoteAnalysisResponse,
  ClinicalNoteDraftView,
  PriorAuthReadiness,
  SdohReferralOpportunity,
  TerminologyCandidate,
} from "@/lib/notes-coding-types";

interface PageData {
  patient: fhir4.Patient;
  conditions: fhir4.Condition[];
}

const CATEGORY_LABELS: Record<ClinicalConceptCategory, string> = {
  diagnosis: "Diagnosis",
  symptom: "Symptoms/findings",
  clinical_finding: "Symptoms/findings",
  medication: "Medications",
  medication_history: "Medication history",
  medication_intolerance: "Adverse effects",
  inadequate_response: "Treatment response",
  adherence_issue: "Adherence/refill",
  refill_issue: "Adherence/refill",
  laboratory_finding: "Laboratory finding",
  treatment_plan: "Treatment plan",
  proposed_medication: "Proposed medication",
  social_determinant: "SDOH barriers",
  referral_need: "Referral need",
  follow_up_need: "Follow-up need",
};

const REVIEW_ORDER: ClinicalConceptCategory[] = [
  "diagnosis",
  "symptom",
  "clinical_finding",
  "medication",
  "medication_history",
  "medication_intolerance",
  "inadequate_response",
  "adherence_issue",
  "refill_issue",
  "laboratory_finding",
  "treatment_plan",
  "proposed_medication",
  "social_determinant",
  "referral_need",
  "follow_up_need",
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusBadge(concept: ClinicalConceptSuggestion) {
  if (concept.clinicianDecision?.status === "approved" || concept.clinicianDecision?.status === "edited") return <Badge variant="success">Approved</Badge>;
  if (concept.clinicianDecision?.status === "rejected") return <Badge variant="neutral">Rejected</Badge>;
  if (concept.status === "absent" || concept.subject !== "patient") return <Badge variant="warning">Not active coding</Badge>;
  if (concept.certainty === "suspected") return <Badge variant="warning">Needs confirmation</Badge>;
  return <Badge variant="purple">Review</Badge>;
}

function candidateLabel(candidate: TerminologyCandidate): string {
  if (candidate.validationStatus !== "validated") return `${candidate.system}: ${candidate.message}`;
  return `${candidate.system}: ${candidate.code} - ${candidate.officialDisplay ?? candidate.display}`;
}

function EvidenceList({ items }: { items: PriorAuthReadiness["evidenceFound"] }) {
  if (items.length === 0) return <p className="text-sm text-[#4F5E70]">No evidence items found.</p>;
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.id} className="rounded-md border border-[#DCE6F0] bg-[#F8FAFD] p-3">
          <div className="flex flex-wrap items-center gap-2">
            {item.status === "found" ? <CheckCircle2 className="size-4 text-[#2F7A4C]" /> : <AlertTriangle className="size-4 text-[#9A6418]" />}
            <span className="text-sm font-semibold text-[#1F2430]">{item.label}</span>
            <Badge variant={item.status === "found" ? "success" : item.status === "missing" ? "warning" : "neutral"}>{item.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-[#4F5E70]">{item.details}</p>
          {item.reference && <p className="mt-1 font-mono text-xs text-[#3F1D63]">{item.reference}</p>}
        </div>
      ))}
    </div>
  );
}

function ConceptCard({
  concept,
  draftId,
  onUpdated,
}: {
  concept: ClinicalConceptSuggestion;
  draftId: string | null;
  onUpdated: (draft: ClinicalNoteDraftView, concept: ClinicalConceptSuggestion) => void;
}) {
  const validated = concept.terminologyCandidates.filter(candidate => candidate.validationStatus === "validated");
  const [candidateId, setCandidateId] = useState(validated[0]?.id ?? "");
  const [editedConcept, setEditedConcept] = useState(concept.normalizedConcept);
  const [busy, setBusy] = useState(false);

  async function approve() {
    if (!draftId) return;
    setBusy(true);
    try {
      const result = await approveClinicalConcept(draftId, concept.id, {
        selectedCandidateId: candidateId || undefined,
        editedConcept: editedConcept.trim() && editedConcept.trim() !== concept.normalizedConcept ? editedConcept.trim() : undefined,
      });
      onUpdated(result.draft, result.concept);
      toast.success("Concept approved and written to FHIR.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to approve concept.");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!draftId) return;
    setBusy(true);
    try {
      const result = await rejectClinicalConcept(draftId, concept.id, { reason: "Not appropriate for coding from this note." });
      onUpdated(result.draft, result.concept);
      toast.success("Concept rejected.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to reject concept.");
    } finally {
      setBusy(false);
    }
  }

  const approvalBlocked = !draftId || busy || validated.length === 0 || concept.status !== "present" || concept.subject !== "patient";

  return (
    <Card className="border-[#DCE6F0]">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#1F2430]">{concept.normalizedConcept}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.04em] text-[#6E7888]">{CATEGORY_LABELS[concept.category]}</p>
          </div>
          {statusBadge(concept)}
        </div>

        <div className="mt-3 rounded-md border border-[#E7EDF4] bg-white p-3">
          <p className="text-xs font-semibold text-[#4F5E70]">Evidence</p>
          <p className="mt-1 text-sm text-[#1F2430]">"{concept.sourceText}"</p>
        </div>

        <div className="mt-3 grid gap-2 text-xs text-[#4F5E70] sm:grid-cols-2">
          <span>Status: {concept.temporality}, {concept.status}</span>
          <span>Certainty: {concept.certainty}</span>
          <span>Subject: {concept.subject}</span>
          <span>Statement: {concept.statementKind}</span>
        </div>

        {concept.clinicalCaveat && (
          <Alert variant="warning" className="mt-3">
            <AlertDescription>{concept.clinicalCaveat}</AlertDescription>
          </Alert>
        )}

        <div className="mt-3 space-y-2">
          <Label htmlFor={`candidate-${concept.id}`}>Validated terminology candidate</Label>
          <select
            id={`candidate-${concept.id}`}
            value={candidateId}
            onChange={event => setCandidateId(event.target.value)}
            className="h-10 w-full rounded-md border border-[#DCE6F0] bg-white px-3 text-sm text-[#1F2430]"
            disabled={validated.length === 0 || !!concept.clinicianDecision}
          >
            {validated.length === 0 ? (
              <option>Terminology candidate unavailable - service configuration required</option>
            ) : (
              validated.map(candidate => (
                <option key={candidate.id} value={candidate.id}>
                  {candidateLabel(candidate)}
                </option>
              ))
            )}
          </select>
          {concept.terminologyCandidates.some(candidate => candidate.validationStatus !== "validated") && (
            <p className="text-xs text-[#6E7888]">
              {concept.terminologyCandidates.find(candidate => candidate.validationStatus !== "validated")?.message}
            </p>
          )}
        </div>

        <div className="mt-3 space-y-2">
          <Label htmlFor={`edit-${concept.id}`}>Edit concept before approval</Label>
          <Input
            id={`edit-${concept.id}`}
            value={editedConcept}
            onChange={event => setEditedConcept(event.target.value)}
            disabled={!!concept.clinicianDecision}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={approve} disabled={approvalBlocked || !!concept.clinicianDecision}>
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={validated.length === 0 || !!concept.clinicianDecision}>
            Choose another
          </Button>
          <Button size="sm" variant="outline" disabled={!!concept.clinicianDecision}>
            Edit concept
          </Button>
          <Button size="sm" variant="outline" onClick={reject} disabled={!draftId || busy || !!concept.clinicianDecision}>
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function NotesCodingPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  const [noteText, setNoteText] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const [noteDate, setNoteDate] = useState(today());
  const [author, setAuthor] = useState(user?.displayName ?? "");
  const [noteType, setNoteType] = useState("Medication escalation review");
  const [draft, setDraft] = useState<ClinicalNoteDraftView | null>(null);
  const [concepts, setConcepts] = useState<ClinicalConceptSuggestion[]>([]);
  const [priorAuth, setPriorAuth] = useState<PriorAuthReadiness | null>(null);
  const [sdohOpportunities, setSdohOpportunities] = useState<SdohReferralOpportunity[]>([]);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [dismissedOpportunities, setDismissedOpportunities] = useState<string[]>([]);
  const [resourceName, setResourceName] = useState("");

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const [patient, conditions, readiness] = await Promise.all([
        getPatient(patientId),
        getPatientConditions(patientId),
        getPriorAuthReadiness(patientId),
      ]);
      setData({ patient, conditions });
      setPriorAuth(readiness);
      if (!author && user?.displayName) setAuthor(user.displayName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Notes & Coding.");
    } finally {
      setLoading(false);
    }
  }, [author, patientId, user?.displayName]);

  useEffect(() => {
    load();
  }, [load]);

  const groupedConcepts = useMemo(() => {
    const groups = new Map<ClinicalConceptCategory, ClinicalConceptSuggestion[]>();
    for (const category of REVIEW_ORDER) groups.set(category, []);
    for (const concept of concepts) groups.get(concept.category)?.push(concept);
    return REVIEW_ORDER.map(category => ({ category, items: groups.get(category) ?? [] })).filter(group => group.items.length > 0);
  }, [concepts]);

  async function saveDraftOnly() {
    if (!patientId) return;
    setBusyAction("save");
    setAnalysisError(null);
    try {
      const input = { noteText, encounterId: encounterId || undefined, noteDate, author, noteType };
      const saved = draft ? await saveClinicalNoteDraft(draft.draftId, input) : await createClinicalNoteDraft(patientId, input);
      setDraft(saved);
      toast.success("Clinical note draft saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save draft.");
    } finally {
      setBusyAction(null);
    }
  }

  async function analyze() {
    if (!patientId) return;
    setBusyAction("analyze");
    setAnalysisError(null);
    try {
      const result: ClinicalNoteAnalysisResponse = await analyzeClinicalNote(patientId, {
        noteText,
        encounterId: encounterId || undefined,
        noteDate,
        author,
        noteType,
      });
      setDraft(result.draft);
      setConcepts(result.concepts);
      setPriorAuth(result.priorAuthReadiness);
      setSdohOpportunities(result.sdohOpportunities);
      toast.success("Note analysis complete.");
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "AI extraction failed. The note was not changed and no FHIR resources were created.");
    } finally {
      setBusyAction(null);
    }
  }

  function clearDraft() {
    setNoteText("");
    setEncounterId("");
    setNoteDate(today());
    setAuthor(user?.displayName ?? "");
    setNoteType("Medication escalation review");
    setDraft(null);
    setConcepts([]);
    setSdohOpportunities([]);
    setAnalysisError(null);
  }

  function handleConceptUpdated(nextDraft: ClinicalNoteDraftView, nextConcept: ClinicalConceptSuggestion) {
    setDraft(nextDraft);
    setConcepts(current => current.map(concept => (concept.id === nextConcept.id ? nextConcept : concept)));
    if (patientId) {
      getPriorAuthReadiness(patientId, nextDraft.draftId).then(setPriorAuth).catch(() => undefined);
    }
  }

  async function finalize() {
    if (!draft) return;
    setBusyAction("finalize");
    try {
      const finalized = await finalizeClinicalNote(draft.draftId);
      setDraft(finalized);
      toast.success("Clinical note finalized.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to finalize note.");
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmRationale(rationale: string) {
    if (!patientId || !draft) return;
    setBusyAction("confirm-rationale");
    try {
      const result = await confirmPriorAuthEvidence(patientId, draft.draftId, rationale);
      setPriorAuth(result.readiness);
      toast.success("Rationale confirmed for review.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to confirm rationale.");
    } finally {
      setBusyAction(null);
    }
  }

  async function createMissingDocTask() {
    if (!patientId) return;
    setBusyAction("create-task");
    try {
      await createPriorAuthTask(patientId, { description: "Prepare missing prior-authorization documentation", focusReference: draft?.fhirReference });
      toast.success("Task created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create Task.");
    } finally {
      setBusyAction(null);
    }
  }

  async function createReferral(opportunity: SdohReferralOpportunity) {
    if (!patientId) return;
    setBusyAction(`referral-${opportunity.id}`);
    try {
      const referral = await createSdohReferralDraft(patientId, {
        conceptId: opportunity.conceptId,
        documentedBarrier: opportunity.documentedBarrier,
        supportType: opportunity.suggestedSupport,
        organizationName: resourceName || undefined,
      });
      toast.success(`Referral draft created: ServiceRequest/${referral.serviceRequestId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create referral draft.");
    } finally {
      setBusyAction(null);
    }
  }

  async function createSdohFollowUpTask(opportunity: SdohReferralOpportunity) {
    if (!patientId) return;
    setBusyAction(`task-${opportunity.id}`);
    try {
      await createPriorAuthTask(patientId, { description: `Follow up on documented barrier: ${opportunity.documentedBarrier}` });
      toast.success("Follow-up Task created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create follow-up Task.");
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <AppShell title="Notes & Coding">
        <p className="text-sm text-muted-foreground">Loading patient...</p>
      </AppShell>
    );
  }

  if (error || !data || !patientId) {
    return (
      <AppShell title="Notes & Coding">
        <Alert variant="destructive">
          <AlertDescription>{error ?? "Unable to load Notes & Coding."}</AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  const visibleOpportunities = sdohOpportunities.filter(opportunity => !dismissedOpportunities.includes(opportunity.id));

  return (
    <AppShell title="Notes & Coding" subtitle="Clinician-reviewed note extraction, coding suggestions, prior-auth evidence, and SDOH coordination.">
      <PatientHeader
        patient={data.patient}
        conditions={data.conditions}
        onCreateTask={() => setCreateTaskOpen(true)}
        onAddClinicalNote={() => document.getElementById("clinical-note-draft")?.focus()}
        onPatientUpdated={() => load()}
      />

      <PatientSubNav patientId={patientId} />

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Clinical note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                AI suggestions are not part of the finalized medical record until reviewed and approved.
              </AlertDescription>
            </Alert>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="encounter">Related Encounter</Label>
                <Input id="encounter" placeholder="Encounter reference or ID" value={encounterId} onChange={event => setEncounterId(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note-date">Note date</Label>
                <Input id="note-date" type="date" value={noteDate} onChange={event => setNoteDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="author">Author</Label>
                <Input id="author" value={author} onChange={event => setAuthor(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note-type">Note type</Label>
                <Input id="note-type" value={noteType} onChange={event => setNoteType(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinical-note-draft">Clinical note draft</Label>
              <Textarea
                id="clinical-note-draft"
                value={noteText}
                onChange={event => setNoteText(event.target.value)}
                className="min-h-[300px]"
                placeholder="Paste a synthetic clinical note. Analysis runs only after Analyze Note is selected."
              />
            </div>

            {analysisError && (
              <Alert variant="destructive">
                <XCircle className="size-4" />
                <AlertDescription>{analysisError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveDraftOnly} disabled={busyAction !== null}>
                <Save className="size-4" />
                Save Draft
              </Button>
              <Button onClick={analyze} disabled={busyAction !== null || noteText.trim().length < 20}>
                <Search className="size-4" />
                Analyze Note
              </Button>
              <Button variant="outline" onClick={clearDraft} disabled={busyAction !== null}>
                <RotateCcw className="size-4" />
                Clear Draft
              </Button>
            </div>

            {draft && (
              <div className="rounded-md border border-[#DCE6F0] bg-[#F8FAFD] p-3 text-sm text-[#4F5E70]">
                Draft: <span className="font-mono text-[#3F1D63]">{draft.fhirReference}</span> · {draft.status}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suggested concepts and terminology</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {concepts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#C9D8E6] p-6 text-center">
                <FileSearch className="mx-auto mb-2 size-6 text-[#6E7888]" />
                <p className="text-sm font-semibold text-[#1F2430]">No clinical note has been analyzed.</p>
                <p className="mt-1 text-sm text-[#4F5E70]">Paste a clinical note and select Analyze Note.</p>
              </div>
            ) : (
              groupedConcepts.map(group => (
                <section key={group.category} className="space-y-3">
                  <h3 className="text-sm font-semibold text-[#3F1D63]">{CATEGORY_LABELS[group.category]}</h3>
                  {group.items.map(concept => (
                    <ConceptCard key={concept.id} concept={concept} draftId={draft?.draftId ?? null} onUpdated={handleConceptUpdated} />
                  ))}
                </section>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Prior Authorization Readiness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {priorAuth ? (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border border-[#DCE6F0] bg-[#F8FAFD] p-3">
                  <p className="text-xs font-semibold uppercase text-[#6E7888]">Requested therapy</p>
                  <p className="mt-1 text-sm font-semibold text-[#1F2430]">{priorAuth.requestedTherapy ?? "Not identified"}</p>
                </div>
                <div className="rounded-md border border-[#DCE6F0] bg-[#F8FAFD] p-3">
                  <p className="text-xs font-semibold uppercase text-[#6E7888]">Authorization requirement</p>
                  <p className="mt-1 text-sm font-semibold text-[#1F2430]">{priorAuth.authorizationRequirement}</p>
                </div>
                <div className="rounded-md border border-[#DCE6F0] bg-[#F8FAFD] p-3">
                  <p className="text-xs font-semibold uppercase text-[#6E7888]">Readiness state</p>
                  <p className="mt-1 text-sm font-semibold text-[#1F2430]">{priorAuth.readinessState}</p>
                </div>
                <div className="rounded-md border border-[#DCE6F0] bg-[#F8FAFD] p-3">
                  <p className="text-xs font-semibold uppercase text-[#6E7888]">Reason for escalation</p>
                  <p className="mt-1 text-sm font-semibold text-[#1F2430]">{priorAuth.reasonForEscalation ?? "Clinician confirmation required"}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[#1F2430]">Evidence found</h3>
                  <EvidenceList items={priorAuth.evidenceFound} />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[#1F2430]">Missing or unverified</h3>
                  <EvidenceList items={priorAuth.missingOrUnverified} />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[#1F2430]">Coding</h3>
                  <EvidenceList items={priorAuth.coding} />
                </div>
              </div>

              {showEvidence && (
                <div className="rounded-lg border border-[#DCE6F0] bg-white p-4">
                  <h3 className="mb-3 text-sm font-semibold text-[#1F2430]">Prior-auth evidence drawer</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[...priorAuth.evidenceFound, ...priorAuth.missingOrUnverified, ...priorAuth.coding].map(item => (
                      <div key={item.id} className="rounded-md border border-[#E7EDF4] p-3">
                        <p className="text-sm font-semibold text-[#1F2430]">{item.label}</p>
                        <p className="mt-1 text-sm text-[#4F5E70]">{item.details}</p>
                        {item.reference && <p className="mt-1 font-mono text-xs text-[#3F1D63]">{item.reference}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setShowEvidence(value => !value)}>
                  <ClipboardList className="size-4" />
                  Review evidence
                </Button>
                <Button variant="outline" onClick={() => confirmRationale(priorAuth.reasonForEscalation ?? "Clinician-confirmed rationale")} disabled={!draft || busyAction !== null}>
                  Confirm rationale
                </Button>
                <Button variant="outline" onClick={createMissingDocTask} disabled={busyAction !== null}>
                  Create missing-document Task
                </Button>
                <Button variant="outline" disabled>
                  Prepare packet
                </Button>
              </div>
            </>
          ) : (
            <Alert variant="warning">
              <AlertDescription>Prior-auth evidence could not be loaded.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>SDOH & Community Referral</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {visibleOpportunities.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#C9D8E6] p-6 text-center">
              <p className="text-sm font-semibold text-[#1F2430]">No documented SDOH barrier found.</p>
              <p className="mt-1 text-sm text-[#4F5E70]">No community referral is suggested from the available note.</p>
            </div>
          ) : (
            visibleOpportunities.map(opportunity => (
              <div key={opportunity.id} className="rounded-lg border border-[#DCE6F0] bg-[#F8FAFD] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1F2430]">Community Support Opportunity</p>
                    <p className="mt-1 text-sm text-[#4F5E70]">Documented barrier: {opportunity.documentedBarrier}</p>
                    <p className="text-sm text-[#4F5E70]">Suggested support: {opportunity.suggestedSupport}</p>
                    <p className="text-sm text-[#4F5E70]">Reason: {opportunity.reason}</p>
                  </div>
                  <Badge variant={opportunity.approvedConceptRequired ? "warning" : "success"}>
                    {opportunity.approvedConceptRequired ? "Approval needed" : "Concept approved"}
                  </Badge>
                </div>
                <div className="mt-3 max-w-xl space-y-2">
                  <Label htmlFor={`resource-${opportunity.id}`}>Community resource name</Label>
                  <Input
                    id={`resource-${opportunity.id}`}
                    value={resourceName}
                    onChange={event => setResourceName(event.target.value)}
                    placeholder="Enter CHC or community organization details if known"
                  />
                  <p className="text-xs text-[#6E7888]">No directory is configured. Resource verification remains pending.</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => toast.info("No CHC/resource directory is configured for this environment.")}>
                    Find CHC or community resource
                  </Button>
                  <Button onClick={() => createReferral(opportunity)} disabled={busyAction !== null || opportunity.approvedConceptRequired}>
                    Create referral draft
                  </Button>
                  <Button variant="outline" onClick={() => createSdohFollowUpTask(opportunity)} disabled={busyAction !== null}>
                    Create follow-up Task
                  </Button>
                  <Button variant="outline" onClick={() => setDismissedOpportunities(current => [...current, opportunity.id])}>
                    Not appropriate
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>FHIR Evidence and Provenance</CardTitle>
        </CardHeader>
        <CardContent>
          {!draft ? (
            <p className="text-sm text-[#4F5E70]">No draft or coding provenance is available yet.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-[#DCE6F0] bg-[#F8FAFD] p-3">
                <p className="text-xs font-semibold uppercase text-[#6E7888]">Draft note</p>
                <p className="mt-1 font-mono text-xs text-[#3F1D63]">{draft.fhirReference}</p>
              </div>
              <div className="rounded-md border border-[#DCE6F0] bg-[#F8FAFD] p-3">
                <p className="text-xs font-semibold uppercase text-[#6E7888]">Created resources</p>
                {draft.createdResourceReferences.length === 0 ? (
                  <p className="mt-1 text-sm text-[#4F5E70]">No approved concepts have created FHIR resources.</p>
                ) : (
                  draft.createdResourceReferences.map(reference => (
                    <p key={reference} className="mt-1 font-mono text-xs text-[#3F1D63]">
                      {reference}
                    </p>
                  ))
                )}
              </div>
              <div className="rounded-md border border-[#DCE6F0] bg-[#F8FAFD] p-3">
                <p className="text-xs font-semibold uppercase text-[#6E7888]">Provenance</p>
                {draft.provenanceReferences.length === 0 ? (
                  <p className="mt-1 text-sm text-[#4F5E70]">No Provenance resources recorded yet.</p>
                ) : (
                  draft.provenanceReferences.map(reference => (
                    <p key={reference} className="mt-1 font-mono text-xs text-[#3F1D63]">
                      {reference}
                    </p>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={finalize} disabled={!draft || draft.status === "finalized" || busyAction !== null}>
              Finalize note
            </Button>
            <Button variant="outline" onClick={() => navigate(`/patients/${patientId}`)}>
              Back to {formatPatientName(data.patient)}
            </Button>
          </div>
        </CardContent>
      </Card>

      <CreateTaskDialog open={createTaskOpen} onOpenChange={setCreateTaskOpen} patientId={patientId} onCreated={() => toast.success("Task created.")} />
    </AppShell>
  );
}
