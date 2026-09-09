import { useCallback } from "react";
import { Activity, Wind } from "lucide-react";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";
import { PortalEmptyState, PortalErrorState, PortalIncompleteData, PortalLoadingState, SourceAndDate } from "@/components/patient-portal/PortalStates";
import { PatientStatusBadge } from "@/components/patient-portal/PatientStatusBadge";
import { getPortalLabs } from "@/lib/patient-portal/client";
import { usePortalData } from "@/lib/patient-portal/use-portal-data";

export function PortalSymptomsBreathingPage() {
  const loader = useCallback(() => getPortalLabs(), []);
  const { data, loading, error, retry } = usePortalData(loader);
  if (loading) return <PortalLoadingState />;
  if (error || !data) return <PortalErrorState message={error ?? undefined} onRetry={retry} />;
  const results = data.results.filter(result => ["respiratory", "oxygen"].includes(result.category));
  return <div><PortalPageHeader title="Symptoms & Breathing" subtitle="Review breathing information documented by your care team." icon={Wind} /><PortalIncompleteData status={data.dataStatus} /><section className="mb-6 rounded-lg border border-[var(--border)] bg-white p-5"><h2 className="flex items-center gap-2 text-base font-semibold"><Activity className="size-5 text-[color:var(--link)]" aria-hidden="true" />Breathing symptoms</h2><p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{results.length ? "Your documented breathing information is shown below." : "No breathing measurements are available in your record yet."}</p><div className="mt-4 rounded-lg bg-[var(--info-bg)] p-4 text-sm text-[color:var(--link)]">If your breathing is worse than usual, follow the action plan shared by your care team or contact them for guidance.</div></section>{results.length === 0 ? <PortalEmptyState title="No breathing results are available yet." detail="Your care team can add breathing information during a visit." /> : <div className="grid gap-4 md:grid-cols-2">{results.map(result => <article key={result.id} className="rounded-lg border border-[var(--border)] bg-white p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{result.plainLanguageName}</h2><PatientStatusBadge label={result.statusLabel} /></div><p className="mt-4 text-2xl font-semibold">{result.value ?? "Not available"} <span className="text-sm font-medium text-[color:var(--muted-foreground)]">{result.unit ?? ""}</span></p><p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{result.whatItMayMean}</p><p className="mt-3 text-sm">Next step: {result.nextStep}</p></article>)}</div>}<div className="mt-5"><SourceAndDate date={data.dataStatus.lastUpdatedAt} /></div></div>;
}
