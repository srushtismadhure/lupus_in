import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { getPatient, getPatientQuestionnaireResponses } from "@/lib/fhir";
import { saveOasisDraft } from "@/lib/oasis/client";
import { formatPatientName } from "@/lib/formatters";
import { applicable, clinicalTimepoints, fromQuestionnaireResponse, generateQuestionnaire, newAssessment, OASIS_CANONICAL, registry, setCanonicalAnswer, skipState, toCms, toQuestionnaireResponse, validateAssessment } from "@/lib/oasis/model";
import type { OasisAssessment, Timepoint } from "@/lib/oasis/model";

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function OasisAssessmentPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [patient, setPatient] = useState<fhir4.Patient | null>(null);
  const [assessment, setAssessment] = useState<OasisAssessment | null>(null);
  const [legacy, setLegacy] = useState<fhir4.QuestionnaireResponse[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("M1400_WHEN_DYSPNEIC");
  useEffect(() => {
    if (!patientId) return;
    let active = true;
          setPatient(null); setAssessment(null); setError(null);
    Promise.all([getPatient(patientId), getPatientQuestionnaireResponses(patientId)]).then(([nextPatient, responses]) => {
      if (!active) return;
      const current = responses.filter(item => item.questionnaire === OASIS_CANONICAL).sort((a, b) => (b.authored ?? "").localeCompare(a.authored ?? ""))[0];
      const next = current ? fromQuestionnaireResponse(current) : newAssessment(patientId);
      if (next.context.subject?.reference !== `Patient/${patientId}`) throw new Error("Assessment patient does not match this page.");
      setAssessment(next); setPatient(nextPatient);
      setLegacy(responses.filter(item => item.questionnaire?.includes("oasis") && item.questionnaire !== OASIS_CANONICAL));
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to load assessment."); });
    return () => { active = false; };
  }, [patientId]);
  async function save() {
    if (!assessment || saving || assessment.context.status !== "in-progress") return;
    setError(null); setSaving(true);
    try {
      setAssessment(await saveOasisDraft(assessment));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save assessment."); }
    finally { setSaving(false); }
  }
  function exportData(kind: "cms" | "fhir" | "questionnaire") {
    if (!assessment) return;
    try { download(`oasis-e2-${kind}.json`, kind === "cms" ? toCms(assessment) : kind === "fhir" ? toQuestionnaireResponse(assessment) : generateQuestionnaire()); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to export assessment."); }
  }
  if (!patient || !assessment) return <AppShell title="OASIS-E2"><p role={error ? "alert" : undefined}>{error ?? "Loading assessment..."}</p></AppShell>;
  const items = registry.items.filter(item => item.group === "Asmt" && applicable(item, assessment.timepoint));
  const sections = [...new Set(items.map(item => item.section))];
  const issues = validateAssessment(assessment);
  const readonly = saving || assessment.context.status !== "in-progress";
  const value = assessment.values[selected];
  const selectedItem = registry.items.find(item => item.cmsItemId === selected);
  return <AppShell title="OASIS-E2" subtitle={`${registry.version} · CMS data specifications ${registry.specificationVersion}`}>
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="OASIS sections" className="flex flex-wrap content-start gap-1 lg:flex-col">{sections.map(section => <a key={section} href={`#oasis-${section}`} className="rounded-md px-3 py-2 text-sm hover:bg-[var(--info-bg)]">Section {section}</a>)}</nav>
      <div className="min-w-0 space-y-5">
        <header className="space-y-3">
          <h2 className="text-lg font-semibold">{formatPatientName(patient)} · OASIS-E2</h2>
          <p className="text-sm text-[color:var(--muted-foreground)]">CMS-derived assessment draft. Full instrument instructions and CMS edit validation are not yet implemented; completion and submission are unavailable.</p>
          <label className="block text-sm">Assessment timepoint <select className="ml-2 max-w-full rounded-md border p-2" value={assessment.timepoint} disabled={readonly || !!assessment.context.id || Object.keys(assessment.values).length > 0} onChange={event => setAssessment(newAssessment(patientId!, event.target.value as Timepoint))}>{clinicalTimepoints.map(option => <option key={option.code} value={option.code}>{option.display}</option>)}</select></label>
          <div className="flex flex-wrap gap-2"><Button onClick={save} disabled={readonly}>{saving ? "Saving..." : "Save Draft"}</Button><Button variant="outline" disabled title="Full CMS edit validation is required before completion.">Complete OASIS</Button><span className="self-center text-sm">{assessment.context.status}</span></div>
          {error && <p role="alert" className="whitespace-pre-line text-sm text-red-700">{error}</p>}
          {issues.length > 0 && <ul className="text-sm text-red-700">{issues.slice(0, 10).map((issue, index) => <li key={index}>{issue.cmsItemId}: {issue.message}</li>)}</ul>}
        </header>
        <details className="border-y border-[var(--border)] py-3">
          <summary className="cursor-pointer text-sm font-semibold">FHIR / CMS Evidence</summary>
          <div className="mt-3 space-y-3">
            <select aria-label="Evidence item" value={selected} onChange={event => setSelected(event.target.value)} className="w-full rounded-md border p-2 text-sm">{items.map(item => <option key={item.cmsItemId} value={item.cmsItemId}>{item.cmsItemId} - {item.text}</option>)}</select>
            <div className="grid gap-3 text-sm sm:grid-cols-2"><div className="min-w-0 break-words"><h3 className="font-semibold">CMS</h3><p>{selected} = {value === undefined ? "Unanswered" : JSON.stringify(value)}</p><p>{selectedItem?.answerOptions.find(option => option.code === value)?.display}</p></div><div className="min-w-0 break-words"><h3 className="font-semibold">FHIR</h3><p>QuestionnaireResponse/{assessment.context.id ?? "unsaved"}</p><p>linkId: {selected}</p><p>{["Code", "Checklist"].includes(selectedItem?.type ?? "") ? "valueCoding.code" : "valueString"}: {value === undefined ? "Unanswered" : JSON.stringify(value)}</p></div></div>
            <p className="text-xs break-all">{assessment.questionnaire} · Timepoint {assessment.timepoint}</p>
            <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => exportData("cms")}>Export CMS structured representation</Button><Button variant="outline" size="sm" onClick={() => exportData("fhir")}>Export FHIR response</Button><Button variant="outline" size="sm" onClick={() => exportData("questionnaire")}>Export Questionnaire</Button></div>
            <p className="text-xs text-[color:var(--muted-foreground)]">Exports reflect the current draft, including unsaved answers. Not an iQIES upload or acceptance confirmation.</p>
          </div>
        </details>
        {legacy.length > 0 && <details className="border-b py-3"><summary className="cursor-pointer text-sm">Historical / legacy OASIS records ({legacy.length})</summary><p className="my-2 text-sm">Retained unchanged. Legacy demo identifiers and values have not been automatically migrated.</p><pre className="max-h-64 overflow-auto text-xs">{JSON.stringify(legacy, null, 2)}</pre></details>}
        {sections.map(section => <section id={`oasis-${section}`} key={section} className="space-y-4 border-b border-[var(--border)] pb-5">
          <h2 className="text-base font-semibold text-[color:var(--brand)]">Section {section}</h2>
          {items.filter(item => item.section === section).map(item => {
            const skipped = skipState(item, assessment.values);
                    const change = (value: string) => {
                      if (readonly) return;
                      setError(null);
                      try {
                        if (!assessment) return;
                        if (value === "") {
                          const values = { ...assessment.values };
                          const reviews = { ...assessment.reviews };
                          delete values[item.cmsItemId];
                          delete reviews[item.cmsItemId];
                          setAssessment({ ...assessment, values, reviews });
                        } else setAssessment(setCanonicalAnswer(assessment, item.cmsItemId, value));
                      } catch (err) { setError(err instanceof Error ? err.message : "Invalid CMS answer."); }
                    };
            return <div key={item.cmsItemId} className="space-y-1">
              <label htmlFor={item.cmsItemId} className="block text-sm font-medium">{item.cmsItemId} · {item.text}</label>
              {["Code", "Checklist"].includes(item.type) ? <select id={item.cmsItemId} value={assessment.values[item.cmsItemId] ?? ""} disabled={readonly} onChange={event => change(event.target.value)} className="min-h-10 w-full max-w-full rounded-md border border-[var(--border)] bg-white px-2 text-sm"><option value="">Unanswered</option>{item.answerOptions.map(option => <option key={option.code} value={option.code}>{option.code} - {option.display}</option>)}</select>
                : <input id={item.cmsItemId} value={assessment.values[item.cmsItemId] ?? ""} disabled={readonly} onChange={event => change(event.target.value)} maxLength={Number(item.source.fixed_rec_lngth)} className="h-10 w-full rounded-md border border-[var(--border)] px-2 text-sm" />}
              {skipped !== "enabled" && <p className="text-xs text-[color:var(--muted-foreground)]">{skipped === "skipped" ? "CMS skip rule requires ^. Review any existing answer." : "Conditional rules require review against CMS instructions."}</p>}
              {item.editIds.length > 0 && <details className="text-xs text-[color:var(--muted-foreground)]"><summary className="cursor-pointer">CMS rules</summary>{item.editIds.map(id => <p key={id} className="mt-2">{id}: {registry.edits[id as keyof typeof registry.edits].text}</p>)}</details>}
            </div>;
          })}
        </section>)}
        <Button asChild variant="outline"><Link to={`/nurse/visits/${patientId}`}>Back to Home Health Visit</Link></Button>
      </div>
    </div>
  </AppShell>;
}
