import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getPatientQuestionnaireResponses } from "@/lib/fhir";
import { acceptCandidate, candidateIssues } from "@/lib/oasis/candidates";
import type { OasisCandidate } from "@/lib/oasis/candidates";
import { fromQuestionnaireResponse, itemById, newAssessment, OASIS_CANONICAL, toQuestionnaireResponse } from "@/lib/oasis/model";
import type { OasisAssessment } from "@/lib/oasis/model";
import { saveOasisDraft } from "@/lib/oasis/client";

type ReviewRow = { candidate: OasisCandidate; value: string; verified: boolean; status: "pending" | "saved" | "rejected" };
export function OasisScribeReview({ patientId, transcript }: { patientId: string; transcript: string }) {
  const [assessment, setAssessment] = useState<OasisAssessment | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { setRows([]); setAssessment(null); setMessage(null); }, [patientId, transcript]);
  async function extract() {
    setBusy(true); setMessage(null); setRows([]);
    try {
      const responses = await getPatientQuestionnaireResponses(patientId);
      const current = responses.filter(response => response.questionnaire === OASIS_CANONICAL).sort((a, b) => (b.authored ?? "").localeCompare(a.authored ?? ""))[0];
      const draft = current ? fromQuestionnaireResponse(current) : newAssessment(patientId);
      if (draft.context.status !== "in-progress") throw new Error("This OASIS assessment is read-only.");
      setAssessment(draft);
      const response = await fetch(`/api/home-health/visits/${encodeURIComponent(patientId)}/extract`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetQuestionnaire: "oasis-e2", transcript, assessment: toQuestionnaireResponse(draft) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "OASIS extraction failed.");
      if (!Array.isArray(body.findings)) throw new Error("Invalid candidate response.");
      const valid = body.findings.filter((candidate: unknown) => candidateIssues(candidate, transcript, draft).length === 0) as OasisCandidate[];
      setRows(valid.map(candidate => ({ candidate, value: candidate.candidateCmsValue, verified: false, status: "pending" })));
      if (!valid.length) setMessage("No supported OASIS candidates found. Complete the assessment through nurse review.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to extract OASIS candidates."); }
    finally { setBusy(false); }
  }
  async function accept(index: number) {
    const row = rows[index];
    if (!assessment || !row || row.status !== "pending" || busy) return;
    setBusy(true); setMessage(null);
    try {
      const next = acceptCandidate(assessment, row.candidate, transcript, row.verified, row.value);
      const saved = await saveOasisDraft(next);
      setAssessment(saved);
      setRows(current => current.map((item, position) => position === index ? { ...item, status: "saved" } : item));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save reviewed OASIS answer."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t border-[var(--border)] pt-3" aria-label="OASIS scribe review">
    <Button variant="outline" onClick={extract} disabled={busy || !transcript.trim()}>{busy ? "Processing OASIS..." : "Extract OASIS Candidates"}</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
    {rows.map((row, index) => {
      const item = itemById.get(row.candidate.cmsItemId)!;
      const disabled = busy || row.status !== "pending";
      const update = (change: Partial<ReviewRow>) => setRows(current => current.map((value, position) => position === index ? { ...value, ...change } : value));
      return <div key={`${row.candidate.cmsItemId}-${index}`} className="space-y-2 border-b py-3 text-sm">
        <h3 className="font-semibold">{item.cmsItemId} · {item.text}</h3>
        <blockquote>{row.candidate.evidenceText}</blockquote>
        <label className="block">Reviewed CMS value{["Code", "Checklist"].includes(item.type) ? <select aria-label={`Reviewed ${item.cmsItemId}`} value={row.value} disabled={disabled} onChange={event => update({ value: event.target.value, verified: false })} className="mt-1 min-h-10 w-full rounded-md border bg-white px-2">{item.answerOptions.map(option => <option key={option.code} value={option.code}>{option.code} - {option.display}</option>)}</select> : <input value={row.value} disabled={disabled} onChange={event => update({ value: event.target.value, verified: false })} className="mt-1 h-10 w-full rounded-md border px-2" />}</label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={row.verified} disabled={disabled} onChange={event => update({ verified: event.target.checked })} />I verified the evidence and response against the official assessment instructions.</label>
        <div className="flex flex-wrap items-center gap-2"><Button size="sm" disabled={disabled || !row.verified} onClick={() => accept(index)}>Accept and save</Button><Button size="sm" variant="outline" disabled={disabled} onClick={() => update({ status: "rejected" })}>Reject</Button><span>{row.status}</span></div>
        {row.status === "saved" && <p className="break-words">CMS {item.cmsItemId} = {JSON.stringify(assessment?.values[item.cmsItemId])}; FHIR linkId {item.cmsItemId}, {item.type === "Code" || item.type === "Checklist" ? "valueCoding.code" : "valueString"} = {JSON.stringify(assessment?.values[item.cmsItemId])}</p>}
      </div>;
    })}
  </section>;
}
