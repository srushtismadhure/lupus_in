import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClinicalNoteDraft, finalizeClinicalNote, saveClinicalNoteDraft } from "@/lib/notes-coding-client";
import type { ClinicalNoteDraftView } from "@/lib/notes-coding-types";

type NarrativeProps = {
  patientId: string;
  encounterId?: string;
  transcript: string;
  onExtract: () => void;
  onLoadDemo: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTranscribe: () => void;
  recording: boolean;
  transcribing: boolean;
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
  const lines = transcript.split(/\n+/).map(line => line.trim()).filter(Boolean);
  return lines.filter(line => patterns.some(pattern => pattern.test(line))).join("\n");
}

export function draftVisitNote(transcript: string): string {
  const sections: Record<(typeof SECTION_LABELS)[number], string> = {
    "Reason for visit": evidence(transcript, [/visit|home|follow-up/i]),
    "Interval history / clinical history": evidence(transcript, [/since|discharge|hospital|ED|worse|better|change/i]),
    "Respiratory assessment": evidence(transcript, [/breath|dyspnea|cough|sputum|wheez|oxygen|liters|respirat/i]),
    "Medication reconciliation": evidence(transcript, [/medication|inhaler|ran out|taking|missed|refill|afford/i]),
    "Functional assessment": evidence(transcript, [/walk|kitchen|activity|stairs|ADL|tolerance|assist/i]),
    "Home / social context": evidence(transcript, [/daughter|caregiver|transport|equipment|home|follow-up|available/i]),
    "Skilled nursing interventions": evidence(transcript, [/teach|education|review|coordinate|notify|assess/i]),
    "Patient/caregiver response": evidence(transcript, [/patient|daughter|understand|agree|response/i]),
    "Clinical assessment / significant findings": evidence(transcript, [/worse|symptom|finding|concern|baseline/i]),
    Plan: evidence(transcript, [/plan|follow-up|pulmonology|rehab|next|schedule|escalat/i]),
  };
  return SECTION_LABELS.map(label => `${label}\n${sections[label]}`).join("\n\n");
}

export function HomeHealthVisitNarrative({ patientId, encounterId, transcript, onExtract, onLoadDemo, onStartRecording, onStopRecording, onTranscribe, recording, transcribing }: NarrativeProps) {
  const [noteText, setNoteText] = useState("");
  const [draft, setDraft] = useState<ClinicalNoteDraftView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function generate() {
    if (!transcript.trim()) return setMessage("Load or transcribe a visit before generating the note.");
    setNoteText(draftVisitNote(transcript));
    setMessage("Draft generated from the transcript. Review every section before saving.");
    onExtract();
  }

  async function save() {
    if (!noteText.trim()) return setMessage("Generate or enter a visit note first.");
    setBusy(true); setMessage(null);
    try {
      const input = { noteText, encounterId, noteDate: new Date().toISOString(), author: "Waypoint Home Health RN", noteType: "Home Health Nursing Visit Note", status: "draft" as const };
      const next = draft ? await saveClinicalNoteDraft(draft.draftId, input) : await createClinicalNoteDraft(patientId, input);
      setDraft(next); setMessage("Draft saved for nurse review. It is not finalized.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save the note draft."); }
    finally { setBusy(false); }
  }

  async function finalize() {
    if (!draft) return setMessage("Save the reviewed draft before finalizing.");
    setBusy(true); setMessage(null);
    try { setDraft(await finalizeClinicalNote(draft.draftId)); setMessage("Final clinical note finalized and persisted as a FHIR DocumentReference."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to finalize the clinical note."); }
    finally { setBusy(false); }
  }

  return <Card className="shadow-none" id="clinical-note">
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Home Health Nursing Visit Note</CardTitle>{draft?.status === "finalized" && <span className="text-sm text-emerald-700">Finalized</span>}</div>
      <p className="text-sm text-[color:var(--muted-foreground)]">Narrative documentation is separate from the CMS OASIS-E2 assessment. AI-generated draft — nurse review required.</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onLoadDemo}>Load Synthetic Demo Conversation</Button>
        {!recording ? <Button onClick={onStartRecording}>Start Recording</Button> : <Button onClick={onStopRecording}>Stop Recording</Button>}
        <Button variant="outline" onClick={onStartRecording}>Dictate Clinical Note</Button>
        <Button onClick={onTranscribe} disabled={!transcript.trim() || transcribing}>Transcribe Visit</Button>
      </div>
      {transcribing && <p className="text-sm">Transcribing visit...</p>}
      <label className="block text-sm font-medium" htmlFor="visit-transcript">VISIT TRANSCRIPT</label>
      <textarea id="visit-transcript" value={transcript} readOnly className="min-h-36 w-full rounded-md border border-[var(--border)] bg-[var(--bg-muted)] p-3 text-sm" placeholder="Load a synthetic conversation or record the visit." />
      <Button onClick={generate} disabled={!transcript.trim()}>Generate Draft Visit Note + Extract Structured Findings</Button>
      <label className="block text-sm font-medium" htmlFor="visit-note-draft">Draft nursing narrative</label>
      <textarea id="visit-note-draft" value={noteText} onChange={event => setNoteText(event.target.value)} disabled={draft?.status === "finalized"} className="min-h-[32rem] w-full rounded-md border border-[var(--border)] p-3 text-sm leading-6" placeholder="The reviewed narrative will appear here, organized by clinical section." />
      <div className="flex flex-wrap items-center gap-2"><Button onClick={save} disabled={busy || draft?.status === "finalized"}>{busy ? "Saving..." : "Save Draft"}</Button><Button variant="outline" onClick={finalize} disabled={busy || !draft || draft.status === "finalized"}>Approve / Finalize Note</Button>{draft && <span className="text-xs text-[color:var(--muted-foreground)]">FHIR {draft.fhirReference}; clinician confirmation required</span>}</div>
      {message && <p role="status" className="text-sm">{message}</p>}
    </CardContent>
  </Card>;
}
