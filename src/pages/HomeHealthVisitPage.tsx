import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { HomeHealthVisitNarrative, type HomeHealthCandidate } from "@/components/HomeHealthVisitNarrative";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPatient,
  getPatientMedicationRequests,
  getPatientObservations,
  getPatientQuestionnaireResponses,
  getPatientTasks,
  saveQuestionnaireResponse,
} from "@/lib/fhir";
import { formatPatientName } from "@/lib/formatters";

const COPD_QUESTIONNAIRE = "https://waypoint.example/fhir/Questionnaire/copd-home-health-subset";
const HOME_HEALTH_IDENTIFIER = "https://waypoint.example/fhir/identifier/home-health";
const COPD_FIELDS = [
  ["spo2", "SpO2"],
  ["respiratory-rate", "Respiratory rate"],
  ["mmrc", "mMRC dyspnea"],
  ["dyspnea-activity", "Dyspnea with activity"],
  ["oxygen-use", "Oxygen use"],
  ["oxygen-flow", "Oxygen flow rate"],
  ["breathing-baseline", "Breathing compared with baseline"],
  ["rescue-inhaler", "Rescue inhaler use"],
  ["medication-use", "Medication use"],
  ["functional", "Functional activity tolerance"],
  ["pulmonology", "Pulmonology follow-up"],
  ["rehab", "Pulmonary rehabilitation"],
  ["inhaler-technique", "Inhaler technique"],
  ["smoking-status", "Smoking status"],
] as const;

type Answers = Record<string, string>;
type ApprovedFinding = HomeHealthCandidate & { approvedValue: string };

function responseAnswers(response: fhir4.QuestionnaireResponse | null): Answers {
  return Object.fromEntries(
    (response?.item ?? []).flatMap(item =>
      item.answer?.[0]?.valueString !== undefined ? [[item.linkId, item.answer[0].valueString]] : [],
    ),
  );
}

function answerItems(answers: Answers) {
  return COPD_FIELDS.map(([linkId, text]) => ({ linkId, text, answer: answers[linkId] ? [{ valueString: answers[linkId] }] : [] }));
}

function medicationRequestText(request: fhir4.MedicationRequest): string {
  return request.medicationCodeableConcept?.text ?? request.medicationCodeableConcept?.coding?.[0]?.display ?? request.medicationReference?.display ?? "";
}

function candidateText(candidate: HomeHealthCandidate, editedValue?: string): string {
  return [editedValue, candidate.candidateValue, candidate.label, candidate.finding, candidate.evidenceText]
    .filter(value => value !== undefined && value !== null)
    .map(String)
    .join(" ")
    .trim();
}

function parsePatientReportedMedication(text: string): { medicationText: string; doseText?: string } | null {
  if (!/\bpropranolol\b/i.test(text)) return null;
  const dose = text.match(/\bpropranolol\b[^\d]{0,24}(\d+(?:\.\d+)?)\s*mg\b/i)?.[1];
  const frequency = /\b(?:twice\s+daily|two\s+times\s+(?:a\s+)?day|bid)\b/i.test(text)
    ? "twice daily"
    : /\bonce\s+daily\b|\bdaily\b/i.test(text)
      ? "once daily"
      : undefined;
  return { medicationText: "Propranolol", doseText: [dose ? `${dose} mg` : undefined, frequency].filter(Boolean).join(" ") || undefined };
}

async function fhirCreate<T extends fhir4.FhirResource>(resourceType: T["resourceType"], resource: T): Promise<T> {
  const response = await fetch(`/fhir/${resourceType}`, {
    method: "POST",
    headers: { Accept: "application/fhir+json", "Content-Type": "application/fhir+json" },
    body: JSON.stringify(resource),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.issue?.[0]?.diagnostics ?? `Unable to create ${resourceType}.`);
  return body as T;
}

export function HomeHealthVisitPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<fhir4.Patient | null>(null);
  const [observations, setObservations] = useState<fhir4.Observation[]>([]);
  const [medications, setMedications] = useState<fhir4.MedicationRequest[]>([]);
  const [tasks, setTasks] = useState<fhir4.Task[]>([]);
  const [copdResponse, setCopdResponse] = useState<fhir4.QuestionnaireResponse | null>(null);
  const [oasisResponse, setOasisResponse] = useState<fhir4.QuestionnaireResponse | null>(null);
  const [copdAnswers, setCopdAnswers] = useState<Answers>({});
  const [transcript, setTranscript] = useState("");
  const [findings, setFindings] = useState<HomeHealthCandidate[]>([]);
  const [approvedFindings, setApprovedFindings] = useState<ApprovedFinding[]>([]);
  const [recording, setRecording] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [liveTranscriptionSupported, setLiveTranscriptionSupported] = useState(true);
  const [liveTranscriptionError, setLiveTranscriptionError] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioBlob = useRef<Blob | null>(null);
  const audioStream = useRef<MediaStream | null>(null);
  const realtimeRef = useRef<RTCPeerConnection | null>(null);
  const realtimeTextRef = useRef("");
  const dictatingRef = useRef(false);

  useEffect(() => {
    if (!visitId) return;
    Promise.all([
      getPatient(visitId),
      getPatientObservations(visitId),
      getPatientMedicationRequests(visitId),
      getPatientTasks(visitId),
      getPatientQuestionnaireResponses(visitId),
    ])
      .then(([nextPatient, nextObservations, nextMedications, nextTasks, responses]) => {
        setPatient(nextPatient);
        setObservations(nextObservations);
        setMedications(nextMedications);
        setTasks(nextTasks);
        const copd = responses.find(item => item.questionnaire?.includes("copd-home-health-subset")) ?? null;
        setCopdResponse(copd);
        setOasisResponse(responses.find(item => item.questionnaire?.includes("oasis-e2")) ?? null);
        setCopdAnswers(responseAnswers(copd));
      })
      .catch(() => setError("Unable to load this visit."));
  }, [visitId]);

  function stopRealtime() {
    realtimeRef.current?.getSenders().forEach(sender => sender.track?.stop());
    realtimeRef.current?.close();
    realtimeRef.current = null;
    setInterimTranscript("");
  }

  async function startRealtime(stream: MediaStream) {
    if (!visitId) return;
    realtimeTextRef.current = "";
    setLiveTranscript("");
    setInterimTranscript("");
    setLiveTranscriptionError(null);
    setLiveTranscriptionSupported(true);
    try {
      const pc = new RTCPeerConnection();
      realtimeRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      const channel = pc.createDataChannel("oai-events");
      channel.onmessage = event => {
        try {
          const message = JSON.parse(event.data as string);
          if (message.type === "conversation.item.input_audio_transcription.delta" || message.type === "response.audio_transcript.delta") {
            realtimeTextRef.current += message.delta ?? "";
            setLiveTranscript(realtimeTextRef.current);
            if (dictatingRef.current) setTranscript(realtimeTextRef.current);
          }
          if (message.type === "error") setLiveTranscriptionError(message.error?.message ?? "OpenAI Realtime transcription error.");
        } catch {
          // Live words are display-only; malformed events do not affect the final server transcript.
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const response = await fetch(`/api/home-health/visits/${encodeURIComponent(visitId)}/realtime`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      const answer = await response.text();
      if (!response.ok) throw new Error(answer || "OpenAI Realtime session could not start.");
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (err) {
      setLiveTranscriptionSupported(false);
      setLiveTranscriptionError(err instanceof Error ? err.message : "OpenAI Realtime transcription could not start.");
      realtimeRef.current?.close();
      realtimeRef.current = null;
    }
  }

  async function saveAssessment(status: fhir4.QuestionnaireResponse["status"] = "in-progress", answers = copdAnswers) {
    if (!visitId) return;
    setSaving(true);
    setError(null);
    try {
      const next = await saveQuestionnaireResponse({
        resourceType: "QuestionnaireResponse",
        status,
        subject: { reference: `Patient/${visitId}` },
        encounter: { reference: `Encounter/${visitId}` },
        authored: new Date().toISOString(),
        author: { display: "Waypoint Home Health RN" },
        id: copdResponse?.id,
        questionnaire: COPD_QUESTIONNAIRE,
        item: answerItems(answers),
      });
      setCopdResponse(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save COPD assessment.");
    } finally {
      setSaving(false);
    }
  }

  function loadDemoTranscript() {
    setTranscript(
      "Nurse: Tell me what has changed since your COPD hospitalization.\n" +
        "Patient: My breathing is worse since discharge. I get short of breath walking to the kitchen.\n" +
        "Nurse: Are you using your albuterol?\n" +
        "Patient: Yes, much more often than usual.\n" +
        "Nurse: Are you taking any medicines that are not on the discharge list?\n" +
        "Patient: Yes. I take propranolol 40 mg twice daily for tremor.\n" +
        "Nurse: Are you taking your maintenance inhaler every day?\n" +
        "Patient: No. I ran out of tiotropium about a week ago.\n" +
        "Nurse: Any follow-up arranged?\n" +
        "Patient: Pulmonology has not been scheduled yet.",
    );
  }

  async function transcribeBlob(blob: Blob) {
    if (!visitId) return;
    setTranscribing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("audio", blob, `${visitId}.webm`);
      const response = await fetch(`/api/home-health/visits/${encodeURIComponent(visitId)}/transcribe`, { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Transcription failed.");
      setTranscript(body.transcript ?? "");
      setLiveTranscript(body.transcript ?? "");
      setInterimTranscript("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }

  function startRecording() {
    setError(null);
    dictatingRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return setError("This browser cannot record audio.");
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      audioStream.current = stream;
      chunks.current = [];
      const next = new MediaRecorder(stream);
      recorder.current = next;
      next.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      next.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        audioStream.current = null;
        const blob = new Blob(chunks.current, { type: next.mimeType || "audio/webm" });
        audioBlob.current = blob;
        setRecording(false);
        stopRealtime();
        await transcribeBlob(blob);
      };
      next.start();
      setRecording(true);
      void startRealtime(stream);
    }).catch(() => setError("Microphone permission was denied or no microphone is available."));
  }

  function startDictation() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      audioStream.current = stream;
      dictatingRef.current = true;
      setDictating(true);
      void startRealtime(stream);
    }).catch(() => setLiveTranscriptionError("Microphone permission was denied or no microphone is available."));
  }

  function stopDictation() {
    dictatingRef.current = false;
    stopRealtime();
    audioStream.current?.getTracks().forEach(track => track.stop());
    audioStream.current = null;
    setDictating(false);
    setTranscript(realtimeTextRef.current);
  }

  useEffect(() => () => {
    stopRealtime();
    audioStream.current?.getTracks().forEach(track => track.stop());
  }, []);

  async function extractFindings() {
    if (!visitId || !transcript.trim()) return;
    const response = await fetch(`/api/home-health/visits/${encodeURIComponent(visitId)}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Structured extraction failed.");
    const raw = body.findings?.findings ?? body.findings;
    const extracted = Array.isArray(raw) ? raw : [];
    setFindings(extracted.map((item: HomeHealthCandidate) => ({ ...item, reviewStatus: "pending" })));
  }

  function approveCandidate(candidate: HomeHealthCandidate, editedValue?: string) {
    const approvedValue = editedValue ?? String(candidate.candidateValue ?? candidate.finding ?? "");
    setFindings(current => current.map(item => item === candidate ? { ...item, candidateValue: approvedValue, reviewStatus: "confirmed" } : item));
    setApprovedFindings(current => [
      ...current.filter(item => !(item.linkId === candidate.linkId && item.finding === candidate.finding)),
      { ...candidate, candidateValue: approvedValue, reviewStatus: "confirmed", approvedValue },
    ]);
  }

  function rejectCandidate(candidate: HomeHealthCandidate) {
    setFindings(current => current.map(item => item === candidate ? { ...item, reviewStatus: "rejected" } : item));
    setApprovedFindings(current => current.filter(item => !(item.linkId === candidate.linkId && item.finding === candidate.finding)));
  }

  async function createClinicianReviewArtifacts(statement: fhir4.MedicationStatement) {
    if (!visitId || !statement.id) return;
    const issue = await fhirCreate<fhir4.DetectedIssue>("DetectedIssue", {
      resourceType: "DetectedIssue",
      identifier: [{ system: HOME_HEALTH_IDENTIFIER, value: `${visitId}-propranolol-copd-${new Date().toISOString().slice(0, 10)}` }],
      status: "preliminary",
      severity: "moderate",
      code: {
        text: "COPD medication review required",
        coding: [{ system: "https://waypoint.example/cds-rules", code: "nonselective-beta-blocker-copd-review", display: "Nonselective beta-blocker requires COPD review" }],
      },
      patient: { reference: `Patient/${visitId}` },
      identifiedDateTime: new Date().toISOString(),
      implicated: [
        { reference: `MedicationStatement/${statement.id}`, display: "Patient-reported propranolol" },
        ...medications.filter(med => /albuterol/i.test(medicationRequestText(med))).slice(0, 1).map(med => ({ reference: `MedicationRequest/${med.id}`, display: medicationRequestText(med) })),
      ],
      detail: "Home Health documented propranolol in a patient with COPD who also uses beta-agonist rescue therapy. Clinician review is recommended; this demo rule does not automatically discontinue medication.",
    });

    await fhirCreate<fhir4.Task>("Task", {
      resourceType: "Task",
      identifier: [{ system: HOME_HEALTH_IDENTIFIER, value: `${visitId}-med-reconciliation-${statement.id}` }],
      status: "requested",
      intent: "order",
      priority: "routine",
      description: "Review Home Health medication reconciliation",
      for: { reference: `Patient/${visitId}` },
      owner: { display: "Clinician review pool" },
      focus: { reference: `DetectedIssue/${issue.id}`, display: "COPD medication review required" },
      authoredOn: new Date().toISOString(),
      note: [{ text: "Patient reports propranolol 40 mg; review indication, respiratory status, and concurrent albuterol use." }],
    });
  }

  async function finalizeApprovedFindings() {
    if (!visitId) return;
    const medicationFindings = approvedFindings.filter(item => parsePatientReportedMedication(candidateText(item, item.approvedValue)));
    let medicationCount = 0;

    for (const finding of medicationFindings) {
      const parsed = parsePatientReportedMedication(candidateText(finding, finding.approvedValue));
      if (!parsed) continue;
      const statement = await fhirCreate<fhir4.MedicationStatement>("MedicationStatement", {
        resourceType: "MedicationStatement",
        identifier: [{ system: HOME_HEALTH_IDENTIFIER, value: `${visitId}-${parsed.medicationText.toLowerCase()}-${new Date().toISOString().slice(0, 10)}` }],
        status: "active",
        medicationCodeableConcept: { text: parsed.medicationText },
        subject: { reference: `Patient/${visitId}` },
        context: { reference: `Encounter/${visitId}` },
        dateAsserted: new Date().toISOString(),
        informationSource: { display: "Waypoint Home Health RN" },
        ...(parsed.doseText ? { dosage: [{ text: parsed.doseText }] } : {}),
        note: [{ text: `Patient-reported medication found at home. Nurse-approved from Home Health note. Evidence: ${finding.evidenceText ?? finding.approvedValue}` }],
      });
      medicationCount += 1;
      if (/propranolol/i.test(parsed.medicationText)) await createClinicianReviewArtifacts(statement);
    }

    const nonMedicationFindings = approvedFindings.filter(item => !parsePatientReportedMedication(candidateText(item, item.approvedValue)));
    for (const finding of nonMedicationFindings) {
      const text = candidateText(finding, finding.approvedValue).toLowerCase();
      if (text.includes("spo2") || text.includes("oxygen saturation")) {
        const numeric = Number(finding.approvedValue.match(/\d+(?:\.\d+)?/)?.[0]);
        if (Number.isFinite(numeric)) await fhirCreate<fhir4.Observation>("Observation", {
          resourceType: "Observation",
          status: "final",
          code: { coding: [{ system: "http://loinc.org", code: "59408-5", display: "Oxygen saturation in arterial blood by pulse oximetry" }], text: "SpO2" },
          subject: { reference: `Patient/${visitId}` },
          effectiveDateTime: new Date().toISOString(),
          valueQuantity: { value: numeric, unit: "%", system: "http://unitsofmeasure.org", code: "%" },
          note: [{ text: "Nurse-approved Home Health finding." }],
        });
      }
    }

    const nextAnswers = { ...copdAnswers, ...(medicationCount ? { "medication-use": `${medicationCount} medication finding(s) sent to reconciliation` } : {}) };
    setCopdAnswers(nextAnswers);
    await saveAssessment("completed", nextAnswers);
    sessionStorage.setItem("waypoint-reconciliation-message", `${medicationCount || approvedFindings.length} approved Home Health finding(s) sent to Medication Reconciliation.`);
    navigate(`/patients/${visitId}/medications?source=home-health&finalized=1`);
  }

  if (!patient) return <AppShell title="Home Health Visit"><p className="text-sm text-[color:var(--muted-foreground)]">{error ?? "Loading visit..."}</p></AppShell>;

  return (
    <AppShell title="Home Health Visit" subtitle="One visit conversation, nurse-approved findings, and structured FHIR evidence">
      <div className="space-y-5">
        <Card className="shadow-none">
          <CardHeader><CardTitle>{formatPatientName(patient)} · Visit workflow</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-sm">
            <Badge variant={copdResponse?.status === "completed" ? "success" : "warning"}>COPD Assessment: {copdResponse?.status ?? "not started"}</Badge>
            <Badge variant={oasisResponse?.status === "completed" ? "success" : "neutral"}>OASIS-E2: {oasisResponse?.status ?? "not started"}</Badge>
            <Badge variant={tasks.filter(task => !["completed", "cancelled", "rejected"].includes(task.status)).length ? "warning" : "success"}>Open tasks: {tasks.filter(task => !["completed", "cancelled", "rejected"].includes(task.status)).length}</Badge>
            <Button asChild variant="outline"><Link to={`/nurse/assessments/${visitId}/oasis`}>Open OASIS-E2</Link></Button>
          </CardContent>
        </Card>

        <HomeHealthVisitNarrative
          patientId={visitId!}
          encounterId={visitId}
          transcript={transcript}
          onTranscriptChange={setTranscript}
          onLoadDemo={loadDemoTranscript}
          onStartRecording={startRecording}
          onStopRecording={() => recorder.current?.stop()}
          onStartDictation={startDictation}
          onStopDictation={stopDictation}
          onTranscribe={() => audioBlob.current ? void transcribeBlob(audioBlob.current) : setError("Record a visit before requesting final transcription.")}
          onGenerateFindings={extractFindings}
          onFinalizeApprovedFindings={finalizeApprovedFindings}
          recording={recording}
          dictating={dictating}
          transcribing={transcribing}
          liveTranscript={liveTranscript}
          interimTranscript={interimTranscript}
          liveTranscriptionSupported={liveTranscriptionSupported}
          liveTranscriptionError={liveTranscriptionError}
          findings={findings}
          onConfirmCandidate={approveCandidate}
          onRejectCandidate={rejectCandidate}
        />

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Waypoint COPD Home Health Assessment</CardTitle>
            <p className="text-sm text-[color:var(--muted-foreground)]">Assessment fields remain editable until the visit is completed.</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {COPD_FIELDS.map(([linkId, label]) => (
              <label key={linkId} className="text-sm">
                <span className="text-[color:var(--muted-foreground)]">{label}</span>
                <input value={copdAnswers[linkId] ?? ""} onChange={event => setCopdAnswers(current => ({ ...current, [linkId]: event.target.value }))} className="mt-1 h-9 w-full rounded-md border border-[var(--border)] px-2" />
              </label>
            ))}
            <div className="sm:col-span-2"><Button onClick={() => saveAssessment()} disabled={saving}>{saving ? "Saving..." : "Save Assessment Draft"}</Button></div>
          </CardContent>
        </Card>

        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2 text-sm text-[color:var(--muted-foreground)]"><span>Observations: {observations.length}</span><span>Prescribed medications: {medications.length}</span><span>Approved findings staged: {approvedFindings.length}</span></div>
      </div>
    </AppShell>
  );
}
