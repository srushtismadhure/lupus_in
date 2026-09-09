import { useCallback } from "react";
import { Activity } from "lucide-react";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";
import { PortalEmptyState, PortalErrorState, PortalIncompleteData, PortalLoadingState, SourceAndDate } from "@/components/patient-portal/PortalStates";
import { PatientStatusBadge } from "@/components/patient-portal/PatientStatusBadge";
import { getPortalCarePlan } from "@/lib/patient-portal/client";
import { usePortalData } from "@/lib/patient-portal/use-portal-data";

export function PortalPulmonaryRehabPage() {
  const loader = useCallback(() => getPortalCarePlan(), []);
  const { data, loading, error, retry } = usePortalData(loader);
  if (loading) return <PortalLoadingState />;
  if (error || !data) return <PortalErrorState message={error ?? undefined} onRetry={retry} />;
  const pathways = data.pathways.filter(pathway => /pulmonary|rehab/i.test(`${pathway.title} ${pathway.purpose} ${pathway.destination ?? ""}`));
  return <div><PortalPageHeader title="Pulmonary Rehab" subtitle="Review referral information and approved plans shared by your care team." icon={Activity} /><PortalIncompleteData status={data.dataStatus} />{pathways.length === 0 ? <PortalEmptyState title="No pulmonary rehabilitation referral is available." detail="Your care team will share a referral or approved plan here if one is added to your record." /> : <div className="space-y-4">{pathways.map(pathway => <article key={pathway.id} className="rounded-lg border border-[var(--border)] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{pathway.title}</h2><p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{pathway.purpose}</p></div><PatientStatusBadge label={pathway.statusLabel} /></div><p className="mt-4 text-sm">Next step: {pathway.nextStep}</p><p className="mt-2 text-sm text-[color:var(--muted-foreground)]">Only follow exercise instructions approved by your care team.</p></article>)}</div>}<div className="mt-5"><SourceAndDate date={data.dataStatus.lastUpdatedAt} /></div></div>;
}
