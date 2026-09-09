import { useCallback, useState } from "react";
import { Apple, MessageCircle, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";
import { PortalEmptyState, PortalErrorState, PortalIncompleteData, PortalLoadingState, SourceAndDate } from "@/components/patient-portal/PortalStates";
import { PatientStatusBadge } from "@/components/patient-portal/PatientStatusBadge";
import { getPortalNutrition, requestNutritionSupport } from "@/lib/patient-portal/client";
import { usePortalData } from "@/lib/patient-portal/use-portal-data";
import { Button } from "@/components/ui/button";

export function PortalNutritionPage() {
  const loader = useCallback(() => getPortalNutrition(), []); const { data, loading, error, retry } = usePortalData(loader); const [sending, setSending] = useState(false); const [sent, setSent] = useState(false);
  if (loading) return <PortalLoadingState />; if (error || !data) return <PortalErrorState message={error ?? undefined} onRetry={retry} />;
  async function requestSupport() { setSending(true); try { await requestNutritionSupport("Nutrition question"); setSent(true); } finally { setSending(false); } }
  const guidance = data.guidance.filter(item => !/kidney|renal|dialysis|transplant|lupus|phosphorus|potassium|fluid restriction/i.test(`${item.title} ${item.recommendation} ${item.whyItMayMatter}`));
  return <div><PortalPageHeader title="Nutrition" subtitle="Review guidance shared by your care team and ask a question when you need help." icon={Apple} /><PortalIncompleteData status={data.dataStatus} />{sent && <p role="status" className="mb-5 rounded-md bg-[var(--success-bg)] p-3 text-sm font-semibold text-[color:var(--success)]">Your nutrition question was sent for care-team review.</p>}{guidance.length === 0 ? <PortalEmptyState title="No nutrition guidance is available yet." detail="Ask your care team or dietitian for advice that fits your care plan." /> : <div className="grid gap-4 md:grid-cols-2">{guidance.map(item => <article key={item.id} className="rounded-lg border border-[var(--border)] bg-white p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{item.title}</h2><PatientStatusBadge label={item.statusLabel} /></div><p className="mt-4 text-sm leading-6">{item.recommendation}</p><p className="mt-3 text-sm text-[color:var(--muted-foreground)]">{item.whyItMayMatter}</p></article>)}</div>}<div className="mt-6 rounded-lg border border-[var(--border)] bg-white p-5"><h2 className="flex items-center gap-2 font-semibold"><MessageCircle className="size-4 text-[color:var(--link)]" aria-hidden="true" />Need help?</h2><p className="mt-2 text-sm text-[color:var(--muted-foreground)]">Ask your care team before making a major change to your diet or supplements.</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={requestSupport} disabled={sending}>{sending ? "Sending..." : "Ask a nutrition question"}<Send aria-hidden="true" /></Button><Button asChild variant="outline"><Link to="/portal/messages">Open messages</Link></Button></div></div><div className="mt-5"><SourceAndDate date={data.dataStatus.lastUpdatedAt} /></div></div>;
}
