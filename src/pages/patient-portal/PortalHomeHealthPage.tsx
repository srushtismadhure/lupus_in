import { useCallback } from "react";
import { House } from "lucide-react";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";
import { PortalEmptyState, PortalErrorState, PortalIncompleteData, PortalLoadingState, SourceAndDate } from "@/components/patient-portal/PortalStates";
import { PatientStatusBadge } from "@/components/patient-portal/PatientStatusBadge";
import { getPortalCarePlan } from "@/lib/patient-portal/client";
import { usePortalData } from "@/lib/patient-portal/use-portal-data";

export function PortalHomeHealthPage() {
  const loader = useCallback(() => getPortalCarePlan(), []);
  const { data, loading, error, retry } = usePortalData(loader);
  if (loading) return <PortalLoadingState />;
  if (error || !data) return <PortalErrorState message={error ?? undefined} onRetry={retry} />;
  const pathways = data.pathways.filter(pathway => /home health|nurse|case manager|visit/i.test(`${pathway.title} ${pathway.purpose} ${pathway.responsibleParty}`));
  return <div><PortalPageHeader title="Home Health" subtitle="See home visits and instructions shared by your care team." icon={House} /><PortalIncompleteData status={data.dataStatus} />{pathways.length === 0 ? <PortalEmptyState title="No home health information is available yet." detail="Home health details will appear here when they are documented in your record." /> : <div className="space-y-4">{pathways.map(pathway => <article key={pathway.id} className="rounded-lg border border-[var(--border)] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{pathway.title}</h2><p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{pathway.purpose}</p></div><PatientStatusBadge label={pathway.statusLabel} /></div><dl className="mt-4 grid gap-3 sm:grid-cols-2"><div><dt className="text-xs font-semibold text-[color:var(--muted-foreground)]">Next step</dt><dd className="mt-1 text-sm">{pathway.nextStep}</dd></div><div><dt className="text-xs font-semibold text-[color:var(--muted-foreground)]">Care team</dt><dd className="mt-1 text-sm">{pathway.responsibleParty}</dd></div></dl>{pathway.patientAction && <p className="mt-4 rounded-lg bg-[var(--info-bg)] p-3 text-sm text-[color:var(--link)]">Your action: {pathway.patientAction}</p>}</article>)}</div>}<div className="mt-5"><SourceAndDate date={data.dataStatus.lastUpdatedAt} /></div></div>;
}
