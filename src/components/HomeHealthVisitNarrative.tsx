import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type HomeHealthCandidate = {
  targetQuestionnaire?: "copd" | "oasis";
  linkId?: string;
  label?: string;
  finding?: string;
  candidateValue?: unknown;
  evidenceText?: string;
  reviewStatus?: "pending" | "confirmed" | "rejected";
};

type NarrativeProps = {
  patientId: string;
  encounterId?: string;
  transcript: string;
  onTranscriptChange: (value: string) => void;
  onLoadDemo: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onStartDictation: () => void;
  onStopDictation: () => void;
  onTranscribe: () => void;
  onGenerateFindings: () => Promise<void>;
  onFinalizeApprovedFindings: () => Promise<void>;
  recording: boolean;
  dictating: boolean;
  transcribing: boolean;
  liveTranscript: string;
  interimTranscript: string;
  liveTranscriptionSupported: boolean;
  liveTranscriptionError: string | null;
  findings: HomeHealthCandidate[];
  onConfirmCandidate: (candidate: HomeHealthCandidate, editedValue?: string) => void;
  onRejectCandidate: (candidate: HomeHealthCandidate) => void;
};

const SECTION_LABELS = [
  "Reason for visit",
  "Interval history / clinical history",
  "Respiratory assessment",
  "Medication reconciliation",
  "Functional assessment",
  "Home / social context",
  "Skilled nursing interventions",
  "Patient/caregiver response",
  "Clinical assessment / significant findings",
  "Plan",
] as const;

function evidence(transcript: string, patterns: RegExp[]): string {
  return transcript
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => patterns.some(pattern => pattern.test(line)))
    .join("\n");
}

export function draftVisitNote(transcript: string): string {
  const sections: Record<(typeof SECTION_LABELS)[number], string> = {
    "Reason for visit": evidence(transcript, [/visit|home|follow-up/i]),
    "Interval history / clinical history": evidence(transcript, [/since|discharge|hospital|ED|worse|better|change/i]),
    "Respiratory assessment": evidence(transcript, [/breath|dyspnea|cough|sputum|wheez|oxygen|liters|respirat|albuterol/i]),
    "Medication reconciliation": evidence(transcript, [/medication|inhaler|propranolol|ran out|taking|missed|refill|afford/i]),
    "Functional assessment": evidence(transcript, [/walk|kitchen|activity|stairs|ADL|tolerance|assist/i]),
    "Home / social context": evidence(transcript, [/daughter|caregiver|transport|equipment|home|follow-up|available/i]),
    "Skilled nursing interventions": evidence(transcript, [/teach|education|review|coordinate|notify|assess/i]),
    "Patient/caregiver response": evidence(transcript, [/patient|daughter|understand|agree|response/i]),
    "Clinical assessment / significant findings": evidence(transcript, [/worse|symptom|finding|concern|baseline/i]),
    Plan: evidence(transcript, [/plan|follow-up|pulmonology|rehab|next|schedule|escalat/i]),
  };
  return SECTION_LABELS.map(label => `${label}\n${sections[label]}`).join("\n\n");
}

function encodeText(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function saveDocumentReference(
  patientId: string,
  encounterId: string | undefined,
  summary: string,
  existing: fhir4.DocumentReference | null,
  docStatus: "preliminary" | "final",
): Promise<fhir4.DocumentReference> {
  const now = new Date().toISOString();
  const resource: fhir4.DocumentReference = {
    resourceType: "DocumentReference",
    ...(existing?.id ? { id: existing.id } : {}),
    status: "current",
    docStatus,
    type: { text: "Home Health Nursing Visit Note" },
    subject: { reference: `Patient/${patientId}` },
    date: now,
    author: [{ display: "Waypoint Home Health RN" }],
    description: "Home Health Nursing Visit Note",
    ...(encounterId ? { context: { encounter: [{ reference: `Encounter/${encounterId}` }] } } : {}),
    content: [
      {
        attachment: {
          contentType: "text/plain; charset=utf-8",
          data: encodeText(summary),
          title: "Home Health Nursing Visit Note",
          creation: now,
        },
      },
    ],
  };

  const path = existing?.id ? `/fhir/DocumentReference/${encodeURIComponent(existing.id)}` : "/fhir/DocumentReference";
  const response = await fetch(path, {
    method: existing?.id ? "PUT" : "POST",
    headers: { Accept: "application/fhir+json", "Content-Type": "application/fhir+json" },
    body: JSON.stringify(resource),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.issue?.[0]?.diagnostics ?? `Unable to ${docStatus === "final" ? "finalize" : "save"} the Home Health note.`);
  }
  return body as fhir4.DocumentReference;
}

export function HomeHealthVisitNarrative({
  patientId,
  encounterId,
  transcript,
  onTranscriptChange,
  onLoadDemo,
  onStartRecording,
  onStopRecording,
  onStartDictation,
  onStopDictation,
  onTranscribe,
  onGenerateFindings,
  onFinalizeApprovedFindings,
  recording,
  dictating,
  transcribing,
  liveTranscript,
  interimTranscript,
  liveTranscriptionSupported,
  liveTranscriptionError,
  findings,
  onConfirmCandidate,
  onRejectCandidate,
}: NarrativeProps) {
  const [summary, setSummary] = useState("");
  const [noteReference, setNoteReference] = useState<fhir4.DocumentReference | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generateSummary() {
    if (!transcript.trim()) {
      setMessage("Review or transcribe the visit before generating a summary.");
      return;
    }
    setSummary(draftVisitNote(transcript));
    setMessage("Clinical summary generated. Waypoint is also extracting structured findings for nurse approval.");
    try {
      await onGenerateFindings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The summary was generated, but structured extraction could not be completed.");
    }
  }

  async function save() {
    if (!summary.trim()) {
      setMessage("Generate or enter a clinical summary first.");
      return;
    }
    setBusy(true);
    try {
      const saved = await saveDocumentReference(patientId, encounterId, summary, noteReference, "preliminary");
      setNoteReference(saved);
      setMessage("Clinical summary saved as a draft. Approved structured findings remain staged until the note is finalized.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the clinical summary.");
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    if (!summary.trim()) {
      setMessage("Generate or enter a clinical summary before finalizing.");
      return;
    }
    setBusy(true);
    setMessage("Finalizing the note and sending approved findings to Medication Reconciliation...");
    try {
      const draft = noteReference ?? (await saveDocumentReference(patientId, encounterId, summary, null, "preliminary"));
      const finalized = await saveDocumentReference(patientId, encounterId, summary, draft, "final");
      setNoteReference(finalized);
      await onFinalizeApprovedFindings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to finalize the Home Health visit.");
    } finally {
      setBusy(false);
    }
  }

  const liveText = `${liveTranscript}${interimTranscript ? ` ${interimTranscript}` : ""}`.trim();
  const approvedCount = findings.filter(candidate => candidate.reviewStatus === "confirmed").length;
  const finalized = noteReference?.docStatus === "final";

  return (
    <Card className="shadow-none" id="clinical-note">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Clinical Summary &amp; Ambient Documentation</CardTitle>
          {finalized && <span className="text-sm font-medium text-emerald-700">Finalized</span>}
        </div>
        <p className="text-sm text-[color:var(--muted-foreground)]">
          The final server transcription is authoritative. AI-extracted findings are staged until the nurse approves them and finalizes the note.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onLoadDemo}>Load Synthetic Demo Conversation</Button>
          {!recording && !dictating ? (
            <Button onClick={onStartRecording}>Start Recording</Button>
          ) : (
            <Button onClick={recording ? onStopRecording : onStopDictation}>Stop {recording ? "Recording" : "Dictation"}</Button>
          )}
          {!recording && !dictating && <Button variant="outline" onClick={onStartDictation}>Dictate Clinical Note</Button>}
          {!recording && !dictating && (
            <Button onClick={onTranscribe} disabled={transcribing || !transcript.trim()}>
              {transcribing ? "Processing final transcript..." : "Transcribe Visit"}
            </Button>
          )}
        </div>

        {(recording || dictating) && (
          <div className="rounded-md border border-[var(--border)] bg-[var(--info-bg)] p-4" aria-live="polite">
            <p className="text-sm font-semibold text-[color:var(--link)]">
              ● {recording ? "Recording" : "Dictating"} · {liveTranscriptionSupported ? "Live transcription active" : "Final transcription available after stop"}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Live transcript</p>
            {liveTranscriptionSupported ? (
              <p className="mt-1 min-h-10 text-sm leading-6">
                <span>{liveTranscript}</span>
                <span className="italic text-[color:var(--muted-foreground)]">{interimTranscript ? ` ${interimTranscript}` : ""}</span>
                {!liveText && <span className="text-[color:var(--muted-foreground)]">Listening...</span>}
              </p>
            ) : (
              <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
                Live transcription is unavailable in this browser. The visit is still being recorded and will be transcribed after recording stops.
              </p>
            )}
            {liveTranscriptionError && <p className="mt-2 text-xs text-red-700">{liveTranscriptionError}</p>}
          </div>
        )}

        <label className="block text-sm font-medium" htmlFor="visit-transcript">Reviewed visit transcript</label>
        <textarea
          id="visit-transcript"
          value={transcript}
          onChange={event => onTranscriptChange(event.target.value)}
          className="min-h-36 w-full rounded-md border border-[var(--border)] bg-[var(--muted)] p-3 text-sm"
          placeholder="Load, transcribe, or dictate a visit."
        />

        <Button onClick={() => void generateSummary()} disabled={!transcript.trim() || busy}>Generate Clinical Summary</Button>

        <label className="block text-sm font-medium" htmlFor="visit-note-draft">Clinical summary</label>
        <textarea
          id="visit-note-draft"
          value={summary}
          onChange={event => setSummary(event.target.value)}
          disabled={finalized}
          className="min-h-64 w-full rounded-md border border-[var(--border)] p-3 text-sm leading-6"
          placeholder="The reviewed summary will appear here, organized by clinical section."
        />

        {findings.length > 0 && (
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <div>
              <h3 className="text-base font-semibold">Structured findings for nurse approval</h3>
              <p className="text-xs text-[color:var(--muted-foreground)]">
                Approving a finding stages it only. FHIR medication/observation writeback occurs after Finalize Note.
              </p>
            </div>
            {findings.map((candidate, index) => (
              <CandidateCard
                key={`${candidate.linkId ?? candidate.finding}-${index}`}
                candidate={candidate}
                onConfirm={onConfirmCandidate}
                onReject={onRejectCandidate}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void save()} disabled={busy || !summary.trim() || finalized}>Save Draft</Button>
          <Button onClick={() => void finalize()} disabled={busy || !summary.trim() || finalized}>
            {busy ? "Working..." : "Approve / Finalize Note"}
          </Button>
          {approvedCount > 0 && !finalized && (
            <span className="text-xs font-medium text-[color:var(--muted-foreground)]">{approvedCount} approved finding{approvedCount === 1 ? "" : "s"} will be written on finalization</span>
          )}
        </div>

        {noteReference?.id && (
          <span className="text-xs text-[color:var(--muted-foreground)]">Source note: FHIR DocumentReference/{noteReference.id}</span>
        )}
        {message && <p role="status" className="text-sm">{message}</p>}
      </CardContent>
    </Card>
  );
}

function CandidateCard({
  candidate,
  onConfirm,
  onReject,
}: {
  candidate: HomeHealthCandidate;
  onConfirm: (candidate: HomeHealthCandidate, editedValue?: string) => void;
  onReject: (candidate: HomeHealthCandidate) => void;
}) {
  const [editedValue, setEditedValue] = useState(String(candidate.candidateValue ?? candidate.finding ?? ""));
  const approved = candidate.reviewStatus === "confirmed";
  const rejected = candidate.reviewStatus === "rejected";

  return (
    <div className={`rounded-md border p-3 text-sm ${approved ? "border-emerald-200 bg-emerald-50/40" : "border-[var(--border)] bg-white"}`}>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="font-medium">{candidate.label ?? "Finding"}</p>
          <p>{candidate.finding ?? candidate.linkId ?? "Clinical finding"}</p>
        </div>
        <label>
          <span className="font-medium">Reviewed value</span>
          <input
            value={editedValue}
            onChange={event => setEditedValue(event.target.value)}
            disabled={approved || rejected}
            className="mt-1 h-9 w-full rounded-md border px-2"
          />
        </label>
      </div>
      <p className="mt-2 text-[color:var(--muted-foreground)]">Evidence: {candidate.evidenceText ?? "No evidence excerpt returned."}</p>
      <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
        Destination after finalization: {candidate.targetQuestionnaire === "oasis" ? "QuestionnaireResponse" : "Observation / MedicationStatement"}
      </p>
      {approved ? (
        <p className="mt-3 text-xs font-semibold text-emerald-700">✓ Approved — staged for finalization</p>
      ) : rejected ? (
        <p className="mt-3 text-xs font-semibold text-[color:var(--muted-foreground)]">Rejected</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onConfirm(candidate, editedValue)}>Approve / Edit</Button>
          <Button size="sm" variant="outline" onClick={() => onReject(candidate)}>Reject</Button>
        </div>
      )}
    </div>
  );
}
