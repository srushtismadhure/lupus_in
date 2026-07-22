import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, MessageCircle, Salad, Send, ShieldAlert, Utensils } from "lucide-react";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";
import { PatientStatusBadge } from "@/components/patient-portal/PatientStatusBadge";
import { PortalErrorState, PortalIncompleteData, PortalLoadingState, SourceAndDate } from "@/components/patient-portal/PortalStates";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPortalNutrition, requestNutritionSupport } from "@/lib/patient-portal/client";
import { usePortalData } from "@/lib/patient-portal/use-portal-data";

export function PortalNutritionPage() {
  const loader = useCallback(() => getPortalNutrition(), []);
  const { data, loading, error, retry } = usePortalData(loader);
  const [topic, setTopic] = useState("Ask about a dietitian referral");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  if (loading) return <PortalLoadingState />;
  if (error || !data) return <PortalErrorState message={error ?? undefined} onRetry={retry} />;
  const dietitian = data.careTeam.find(member => member.role.toLowerCase().includes("diet"));
  const nutritionPathway = data.carePlan.find(pathway => pathway.title.toLowerCase().includes("nutrition"));

  async function requestSupport() {
    setSending(true);
    setSent(false);
    try {
      await requestNutritionSupport(topic, message || undefined);
      setSent(true);
      setMessage("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PortalPageHeader title="My Nutrition Plan" subtitle="Food guidance based on the information currently available in your care plan." icon={Utensils} />
      <PortalIncompleteData status={data.dataStatus} />
      <aside className="mb-5 rounded-lg border border-[#C5E3F5] bg-[#EDF7FD] p-4"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0 text-[#245D86]" aria-hidden="true" /><div><h2 className="font-semibold text-[#1F2430]">Nutrition safety</h2><p className="mt-1 text-sm leading-6 text-[#365B73]">This portal does not prescribe potassium, phosphorus, protein, fluid, supplement, fasting, or herbal-product changes. Follow only instructions approved by your care team or dietitian.</p></div></div></aside>

      <section aria-labelledby="guidance-heading"><h2 id="guidance-heading" className="text-lg font-semibold text-[#1F2430]">Current guidance</h2><div className="mt-3 grid gap-4 md:grid-cols-2">{data.guidance.map(item => (
        <article key={item.id} className="rounded-lg border border-[#DCE6F0] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold text-[#1F2430]"><Salad className="size-5 text-[#3577A2]" aria-hidden="true" />{item.title}</h3><PatientStatusBadge label={item.statusLabel} /></div>
          <p className="mt-4 text-sm leading-6 text-[#344253]">{item.recommendation}</p>
          <div className="mt-4 border-t border-[#E6ECF2] pt-3"><h4 className="text-sm font-semibold text-[#1F2430]">Why this may matter</h4><p className="mt-1 text-sm leading-6 text-[#526172]">{item.whyItMayMatter}</p></div>
          {item.safetyNote && <p className="mt-3 rounded-lg bg-[#FFF9EC] px-3 py-2 text-xs leading-5 text-[#6F4A13]">{item.safetyNote}</p>}
          {(item.reviewedBy || item.reviewedAt) && <p className="mt-3 text-xs text-[#526172]">Reviewed by {item.reviewedBy ?? "your care team"}{item.reviewedAt ? ` on ${new Date(item.reviewedAt).toLocaleDateString()}` : ""}</p>}
        </article>
      ))}</div></section>

      <section className="mt-7" aria-labelledby="meal-ideas-heading"><h2 id="meal-ideas-heading" className="text-lg font-semibold text-[#1F2430]">Meal ideas</h2><p className="mt-1 text-sm text-[#526172]">These are general examples filtered against documented allergies. They are not a prescribed diet and do not treat lupus nephritis.</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.mealIdeas.map(meal => <article key={meal.id} className="rounded-lg border border-[#DCE6F0] bg-white p-4"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-[#2F7A4C]" aria-hidden="true" />{meal.title}</p><p className="mt-2 text-xs text-[#697586]">General meal example</p></article>)}</div></section>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-[#DCE6F0] bg-white p-5" aria-labelledby="dietitian-heading"><h2 id="dietitian-heading" className="text-lg font-semibold text-[#1F2430]">My dietitian</h2>{dietitian ? <div className="mt-3"><p className="font-semibold">{dietitian.name}</p><p className="text-sm text-[#526172]">{dietitian.role}{dietitian.organization ? ` · ${dietitian.organization}` : ""}</p><p className="mt-3 text-sm text-[#526172]">{dietitian.howTheyHelp}</p></div> : <p className="mt-3 text-sm leading-6 text-[#526172]">No dietitian is currently listed in the available care team. Would you like help discussing nutrition with your care team?</p>}{nutritionPathway && <div className="mt-4"><PatientStatusBadge label={nutritionPathway.statusLabel} /><p className="mt-2 text-sm text-[#526172]">Next: {nutritionPathway.nextStep}</p></div>}<Button asChild variant="outline" className="mt-4 min-h-11"><Link to="/portal/messages"><MessageCircle aria-hidden="true" />Message care team</Link></Button></section>
        <section className="rounded-lg border border-[#DCE6F0] bg-white p-5" aria-labelledby="request-support-heading"><h2 id="request-support-heading" className="text-lg font-semibold text-[#1F2430]">Request nutrition support</h2><p className="mt-1 text-sm text-[#526172]">This sends a patient request for care-team review. It does not create or sign a nutrition order.</p><div className="mt-4 space-y-3"><div><Label htmlFor="nutrition-topic">What would you like help with?</Label><select id="nutrition-topic" value={topic} onChange={event => setTopic(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#BFCFDC] bg-white px-3 text-sm"><option>Ask about a dietitian referral</option><option>Ask a nutrition question</option><option>Review my current nutrition plan</option></select></div><div><Label htmlFor="nutrition-message">Additional details (optional)</Label><Textarea id="nutrition-message" value={message} onChange={event => setMessage(event.target.value)} maxLength={1000} rows={4} className="mt-1" /></div><Button type="button" className="min-h-11" disabled={sending} onClick={requestSupport}><Send aria-hidden="true" />{sending ? "Sending..." : "Send request"}</Button>{sent && <p role="status" aria-live="polite" className="text-sm font-semibold text-[#2F6F47]">Your request was recorded for care-team review.</p>}</div></section>
      </div>
      <div className="mt-5"><SourceAndDate date={data.dataStatus.lastUpdatedAt} /></div>
    </div>
  );
}

