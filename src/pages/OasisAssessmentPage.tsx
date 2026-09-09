import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPatient, getPatientQuestionnaireResponses } from "@/lib/fhir";
import { formatPatientName } from "@/lib/formatters";

const SECTIONS = [
  ["A", "Administrative Information"], ["B", "Hearing, Speech, and Vision"], ["C", "Cognitive Patterns"], ["D", "Mood"], ["E", "Behavior"], ["F", "Preferences for Customary Routine and Activities"], ["G", "Functional Status"], ["GG", "Functional Abilities"], ["H", "Bladder and Bowel"], ["J", "Health Conditions"], ["K", "Swallowing / Nutritional Status"], ["M", "Skin Conditions"], ["N", "Medications"], ["O", "Special Treatments, Procedures, and Programs"], ["Q", "Participation in Assessment and Goal Setting"],
] as const;
const ITEMS = [
  { section: "J", id: "M1033", text: "Risk for hospitalization", options: ["0 — No", "1 — Yes"] },
  { section: "J", id: "M1400", text: "When is the patient dyspneic or noticeably short of breath?", options: ["0 — Patient has no shortness of breath", "1 — When walking more than 20 feet", "2 — With moderate exertion", "3 — With minimal exertion", "4 — At rest"] },
  { section: "N", id: "N0415", text: "High-risk drug classes: use and indication", options: ["0 — Not used", "1 — Used; indication noted"] },
  { section: "N", id: "M2001", text: "Drug regimen review", options: ["0 — No problems found", "1 — Problems found", "9 — NA"] },
  { section: "O", id: "O0100C", text: "Oxygen therapy", options: ["0 — No", "1 — Yes"] },
] as const;

export function OasisAssessmentPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [patient, setPatient] = useState<fhir4.Patient | null>(null);
  const [response, setResponse] = useState<fhir4.QuestionnaireResponse | null>(null);
  useEffect(() => { if (!patientId) return; Promise.all([getPatient(patientId), getPatientQuestionnaireResponses(patientId)]).then(([nextPatient, responses]) => { setPatient(nextPatient); setResponse(responses.find(item => item.questionnaire?.includes("oasis-e2-demo-subset")) ?? null); }); }, [patientId]);
  if (!patient) return <AppShell title="OASIS-E2 Demo Subset"><p className="text-sm text-[color:var(--muted-foreground)]">Loading assessment...</p></AppShell>;
  return <AppShell title="OASIS-E2 Demo Subset" subtitle="Start of Care · Official item identifiers shown in a clearly labeled demo subset"><div className="grid gap-5 lg:grid-cols-[260px_1fr]"><Card className="h-fit shadow-none"><CardHeader><CardTitle className="text-base">Sections</CardTitle></CardHeader><CardContent className="space-y-1">{SECTIONS.map(([code, label]) => <a key={code} href={`#oasis-${code}`} className="block rounded-md px-3 py-2 text-sm hover:bg-[var(--info-bg)]">{code} — {label}</a>)}</CardContent></Card><div className="space-y-5"><Card className="shadow-none"><CardHeader><CardTitle>{formatPatientName(patient)} · OASIS-E2 Demo Subset</CardTitle><p className="text-sm text-[color:var(--muted-foreground)]">{response?.status === "completed" ? <Badge variant="success">Completed</Badge> : <Badge variant="neutral">Not started</Badge>} Official OASIS responses are selected by the nurse; transcript evidence never auto-selects answers.</p></CardHeader></Card>{SECTIONS.map(([code, label]) => <section id={`oasis-${code}`} key={code}><Card className="shadow-none"><CardHeader><CardTitle className="text-base">{code} — {label}</CardTitle></CardHeader><CardContent className="space-y-4">{ITEMS.filter(item => item.section === code).length ? ITEMS.filter(item => item.section === code).map(item => <div key={item.id} className="border-b border-[var(--border)] pb-4 last:border-0"><p className="text-sm font-semibold">{item.id} — {item.text}</p><div className="mt-2 space-y-2">{item.options.map(option => <label key={option} className="flex items-center gap-2 text-sm"><input type="radio" name={item.id} defaultChecked={response?.item?.find(answer => answer.linkId === item.id)?.answer?.[0]?.valueString === option.split(" — ")[0]} />{option}</label>)}</div></div>) : <p className="text-sm text-[color:var(--muted-foreground)]">No demo subset items loaded for this section.</p>}</CardContent></Card></section>)}<Button asChild variant="outline"><Link to={`/nurse/assessments/${patientId}`}>Back to Assessments</Link></Button></div></div></AppShell>;
}
