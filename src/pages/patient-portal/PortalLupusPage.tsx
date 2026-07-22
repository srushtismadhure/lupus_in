import { useCallback } from "react";
import { Activity, ChevronDown } from "lucide-react";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";
import { PatientStatusBadge } from "@/components/patient-portal/PatientStatusBadge";
import { PortalEmptyState, PortalErrorState, PortalIncompleteData, PortalLoadingState, SourceAndDate } from "@/components/patient-portal/PortalStates";
import { getPortalLupus } from "@/lib/patient-portal/client";
import { usePortalData } from "@/lib/patient-portal/use-portal-data";

export function PortalLupusPage() {
  const loader = useCallback(() => getPortalLupus(), []);
  const { data, loading, error, retry } = usePortalData(loader);
  if (loading) return <PortalLoadingState />;
  if (error || !data) return <PortalErrorState message={error ?? undefined} onRetry={retry} />;
  return (
    <div>
      <PortalPageHeader title="My Lupus" subtitle="A clear view of how lupus is being monitored across your body." icon={Activity} />
      <PortalIncompleteData status={data.dataStatus} />
      {data.systems.length === 0 ? <PortalEmptyState title="No lupus-system information is available yet." detail="No condition found does not mean no disease. Ask your care team what is being monitored." /> : (
        <section className="grid items-start gap-4 md:grid-cols-2" aria-label="Lupus system overview">
          {data.systems.map(system => (
            <article key={system.id} className="rounded-lg border border-[#DCE6F0] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-base font-semibold text-[#1F2430]">{system.title}</h2><PatientStatusBadge label={system.statusLabel} /></div>
              <p className="mt-3 text-sm leading-6 text-[#526172]">{system.summary}</p>
              <p className="mt-3 text-sm font-medium text-[#344253]"><strong>Next step:</strong> {system.nextStep}</p>
              <details className="mt-4 border-t border-[#E6ECF2] pt-3 group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-[#3F1D63] outline-none focus-visible:rounded focus-visible:ring-[3px] focus-visible:ring-[#4F97C8]/40">More about this area<ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary>
                <div className="space-y-4 pb-2 pt-3 text-sm text-[#526172]">
                  <div><h3 className="font-semibold text-[#344253]">What is being monitored</h3>{system.monitoredItems.length ? <ul className="mt-1 list-disc space-y-1 pl-5">{system.monitoredItems.map(item => <li key={item}>{item}</li>)}</ul> : <p className="mt-1">Not enough recent information is available.</p>}</div>
                  <div><h3 className="font-semibold text-[#344253]">Most recent information</h3>{system.latestInformation.length ? <ul className="mt-1 list-disc space-y-1 pl-5">{system.latestInformation.map(item => <li key={item}>{item}</li>)}</ul> : <p className="mt-1">No recent system-specific information is available.</p>}</div>
                  <div><h3 className="font-semibold text-[#344253]">Questions for your care team</h3><ul className="mt-1 list-disc space-y-1 pl-5">{system.questions.map(question => <li key={question}>{question}</li>)}</ul></div>
                </div>
              </details>
            </article>
          ))}
        </section>
      )}
      <div className="mt-5"><SourceAndDate date={data.dataStatus.lastUpdatedAt} /></div>
    </div>
  );
}

