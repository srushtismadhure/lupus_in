import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { HomeHealthVisitNarrative } from "@/components/HomeHealthVisitNarrative";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPatient, getPatientMedicationRequests, getPatientObservations, getPatientQuestionnaireResponses, getPatientTasks, saveQuestionnaireResponse } from "@/lib/fhir";
import { formatPatientName } from "@/lib/formatters";

const COPD_QUESTIONNAIRE = "https://waypoint.example/fhir/Questionnaire/copd-home-health-subset";
const COPD_FIELDS = [["spo2", "SpO2"], ["respiratory-rate", "Respiratory rate"], ["mmrc", "mMRC dyspnea"], ["dyspnea-activity", "Dyspnea with activity"], ["oxygen-use", "Oxygen use"], ["oxygen-flow", "Oxygen flow rate"], ["breathing-baseline", "Breathing compared with baseline"], ["rescue-inhaler", "Rescue inhaler use"], ["medication-use", "Medication use"], ["functional", "Functional activity tolerance"], ["pulmonology", "Pulmonology follow-up"], ["rehab", "Pulmonary rehabilitation"], ["inhaler-technique", "Inhaler technique"], ["smoking-status", "Smoking status"]] as const;
type Candidate = { targetQuestionnaire?: "copd" | "oasis"; linkId?: string; label?: string; finding?: string; candidateValue?: unknown; evidenceText?: string; reviewStatus?: "pending" | "confirmed" | "rejected" };
type Answers = Record<string, string>;

function responseAnswers(response: fhir4.QuestionnaireResponse | null): Answers { return Object.fromEntries((response?.item ?? []).flatMap(item => item.answer?.[0]?.valueString !== undefined ? [[item.linkId, item.answer[0].valueString]] : [])); }
function answerItems(answers: Answers) { return COPD_FIELDS.map(([linkId, text]) => ({ linkId, text, answer: answers[linkId] ? [{ valueString: answers[linkId] }] : [] })); }

export function HomeHealthVisitPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const [patient, setPatient] = useState<fhir4.Patient | null>(null);
  const [observations, setObservations] = useState<fhir4.Observation[]>([]);
  const [medications, setMedications] = useState<fhir4.MedicationRequest[]>([]);
  const [tasks, setTasks] = useState<fhir4.Task[]>([]);
  const [copdResponse, setCopdResponse] = useState<fhir4.QuestionnaireResponse | null>(null);
  const [oasisResponse, setOasisResponse] = useState<fhir4.QuestionnaireResponse | null>(null);
  const [copdAnswers, setCopdAnswers] = useState<Answers>({});
  const [transcript, setTranscript] = useState("");
  const [findings, setFindings] = useState<Candidate[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioBlob = useRef<Blob | null>(null);

  useEffect(() => { if (!visitId) return; Promise.all([getPatient(visitId), getPatientObservations(visitId), getPatientMedicationRequests(visitId), getPatientTasks(visitId), getPatientQuestionnaireResponses(visitId)]).then(([nextPatient, nextObservations, nextMedications, nextTasks, responses]) => { setPatient(nextPatient); setObservations(nextObservations); setMedications(nextMedications); setTasks(nextTasks); const copd = responses.find(item => item.questionnaire?.includes("copd-home-health-subset")) ?? null; setCopdResponse(copd); setOasisResponse(responses.find(item => item.questionnaire?.includes("oasis-e2")) ?? null); setCopdAnswers(responseAnswers(copd)); }).catch(() => setError("Unable to load this visit.")); }, [visitId]);
  function setAnswer(linkId: string, value: string) { setCopdAnswers(current => ({ ...current, [linkId]: value })); }
  async function saveAssessment(status: fhir4.QuestionnaireResponse["status"] = "in-progress") { if (!visitId) return; setSaving(true); setError(null); try { const next = await saveQuestionnaireResponse({ resourceType: "QuestionnaireResponse", status, subject: { reference: `Patient/${visitId}` }, encounter: { reference: `Encounter/${visitId}` }, authored: new Date().toISOString(), author: { display: "Waypoint Home Health RN" }, id: copdResponse?.id, questionnaire: COPD_QUESTIONNAIRE, item: answerItems(copdAnswers) }); setCopdResponse(next); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save COPD assessment."); } finally { setSaving(false); } }
  function loadDemoTranscript() { setTranscript("Nurse: Tell me what has changed since your COPD hospitalization.\nPatient: My breathing is worse since discharge. I get short of breath walking to the kitchen and stairs are difficult.\nNurse: Are you using oxygen at home?\nPatient: Yes, two liters at night.\nNurse: Are you taking your maintenance inhaler every day?\nPatient: No. I ran out of tiotropium about a week ago. My daughter usually picks up medications, but she is unavailable this week and I cannot afford a refill.\nNurse: Any follow-up arranged?\nPatient: Pulmonology has not been scheduled yet."); }
  function startRecording() { setError(null); if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return setError("Audio recording is not supported in this browser."); navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => { chunks.current = []; const next = new MediaRecorder(stream); recorder.current = next; next.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); }; next.onstop = () => { stream.getTracks().forEach(track => track.stop()); audioBlob.current = new Blob(chunks.current, { type: next.mimeType || "audio/webm" }); setRecording(false); }; next.start(); setRecording(true); }).catch(() => setError("Microphone permission was denied or no microphone is available.")); }
  function stopRecording() { recorder.current?.stop(); }
  async function transcribe() { if (!audioBlob.current || !visitId) return; setTranscribing(true); setError(null); try { const form = new FormData(); form.append("audio", audioBlob.current, `${visitId}.webm`); const response = await fetch(`/api/home-health/visits/${encodeURIComponent(visitId)}/transcribe`, { method: "POST", body: form }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Transcription failed."); setTranscript(body.transcript ?? ""); } catch (err) { setError(err instanceof Error ? err.message : "Transcription failed."); } finally { setTranscribing(false); } }
  async function extractFindings() { if (!visitId || !transcript.trim()) return; try { const response = await fetch(`/api/home-health/visits/${encodeURIComponent(visitId)}/extract`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Extraction failed."); const raw = body.findings?.findings ?? body.findings; setFindings(Array.isArray(raw) ? raw : []); } catch (err) { setError(err instanceof Error ? err.message : "Structured extraction failed."); } }
  function accept(candidate: Candidate) { if (!candidate.linkId || candidate.targetQuestionnaire !== "copd") return; setAnswer(candidate.linkId, String(candidate.candidateValue ?? candidate.finding ?? "")); setFindings(current => current.map(item => item === candidate ? { ...item, reviewStatus: "confirmed" } : item)); }
  if (!patient) return <AppShell title="Home Health Visit"><p className="text-sm text-[color:var(--muted-foreground)]">{error ?? "Loading visit..."}</p></AppShell>;
  return <AppShell title="Home Health Visit" subtitle="One visit conversation, reviewed narrative, structured findings, and OASIS evidence"><div className="space-y-5">
    <Card className="shadow-none"><CardHeader><CardTitle>{formatPatientName(patient)} · Visit workflow</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2 text-sm"><Badge variant={copdResponse?.status === "completed" ? "success" : "warning"}>COPD Assessment: {copdResponse?.status ?? "not started"}</Badge><Badge variant={oasisResponse?.status === "completed" ? "success" : "neutral"}>OASIS-E2: {oasisResponse?.status ?? "not started"}</Badge><Badge variant={tasks.length ? "warning" : "success"}>Open tasks: {tasks.filter(task => task.status !== "completed").length}</Badge><Button asChild variant="outline"><Link to={`/nurse/assessments/${visitId}/oasis`}>Open OASIS-E2</Link></Button></CardContent></Card>
    <HomeHealthVisitNarrative patientId={visitId!} encounterId={visitId} transcript={transcript} onLoadDemo={loadDemoTranscript} onStartRecording={startRecording} onStopRecording={stopRecording} onTranscribe={transcribe} recording={recording} transcribing={transcribing} onExtract={extractFindings} />
    <Card className="shadow-none"><CardHeader><CardTitle>Waypoint COPD Home Health Assessment</CardTitle><p className="text-sm text-[color:var(--muted-foreground)]">Structured findings are candidates until the nurse confirms them.</p></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{COPD_FIELDS.map(([linkId, label]) => <label key={linkId} className="text-sm"><span className="text-[color:var(--muted-foreground)]">{label}</span><input value={copdAnswers[linkId] ?? ""} onChange={event => setAnswer(linkId, event.target.value)} className="mt-1 h-9 w-full rounded-md border border-[var(--border)] px-2" /></label>)}<div className="sm:col-span-2"><Button onClick={() => saveAssessment()} disabled={saving}>{saving ? "Saving..." : "Save Draft"}</Button><Button className="ml-2" onClick={() => saveAssessment("completed")} disabled={saving}>Complete Assessment</Button></div></CardContent></Card>
    {findings.length > 0 && <Card className="shadow-none"><CardHeader><CardTitle>Structured findings for nurse review</CardTitle></CardHeader><CardContent className="space-y-3">{findings.map((finding, index) => <div key={`${finding.linkId ?? finding.finding}-${index}`} className="border-b pb-3 text-sm"><p className="font-medium">{finding.label ?? finding.finding ?? finding.linkId}</p><p className="text-[color:var(--muted-foreground)]">{finding.evidenceText ?? "No evidence excerpt returned."}</p>{finding.reviewStatus !== "confirmed" ? <Button size="sm" className="mt-2" onClick={() => accept(finding)}>Confirm COPD finding</Button> : <span className="text-emerald-700">Confirmed for review</span>}</div>)}</CardContent></Card>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex flex-wrap gap-2 text-sm text-[color:var(--muted-foreground)]"><span>Observations: {observations.length}</span><span>Medications: {medications.length}</span><span>OASIS remains a separate CMS-defined assessment.</span></div>
  </div></AppShell>;
}
