import { useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FlaskConical } from "lucide-react";
import { PatientStatusBadge } from "@/components/patient-portal/PatientStatusBadge";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";
import { PortalEmptyState, PortalErrorState, PortalIncompleteData, PortalLoadingState, SourceAndDate } from "@/components/patient-portal/PortalStates";
import { getPortalLabs } from "@/lib/patient-portal/client";
import { usePortalData } from "@/lib/patient-portal/use-portal-data";
import type { PatientLabCategory } from "@/lib/patient-portal/types";

const GROUPS: Array<{ id: PatientLabCategory; label: string }> = [
  { id: "kidney-function", label: "Kidney function" },
  { id: "urine-protein", label: "Urine and protein" },
  { id: "lupus-activity", label: "Lupus activity" },
  { id: "blood-count", label: "Blood counts" },
  { id: "electrolyte", label: "Electrolytes and minerals" },
  { id: "other", label: "General health monitoring" },
];

function dateOnly(value: string | null): string {
  if (!value) return "Date not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export function PortalLabsPage() {
  const loader = useCallback(() => getPortalLabs(), []);
  const { data, loading, error, retry } = usePortalData(loader);
  if (loading) return <PortalLoadingState />;
  if (error || !data) return <PortalErrorState message={error ?? undefined} onRetry={retry} />;
  return (
    <div>
      <PortalPageHeader title="My Lab Results" subtitle="See your latest blood and urine results, what they mean, and what happens next." icon={FlaskConical} />
      <PortalIncompleteData status={data.dataStatus} />
      {data.results.length === 0 ? <PortalEmptyState title="No lab results are available for this section yet." /> : (
        <div className="space-y-7">
          {GROUPS.map(group => {
            const results = data.results.filter(result => result.category === group.id);
            if (results.length === 0) return null;
            return <section key={group.id} aria-labelledby={`lab-group-${group.id}`}><h2 id={`lab-group-${group.id}`} className="text-lg font-semibold text-[color:var(--foreground)]">{group.label}</h2><div className="mt-3 grid gap-4 lg:grid-cols-2">{results.map(result => (
              <article key={result.id} className="rounded-lg border border-[var(--border)] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-[color:var(--foreground)]">{result.plainLanguageName}</h3><p className="mt-1 text-xs text-[color:var(--muted-foreground)]">{result.name}</p></div><PatientStatusBadge label={result.statusLabel} /></div>
                <p className="mt-4 text-2xl font-semibold text-[color:var(--foreground)]">{result.value ?? "Not available"} <span className="text-sm font-medium text-[color:var(--muted-foreground)]">{result.unit ?? ""}</span></p>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{dateOnly(result.date)}</p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2"><div><dt className="text-xs font-semibold text-[color:var(--muted-foreground)]">Reported reference range</dt><dd className="mt-1 text-sm text-[color:var(--foreground)]">{result.referenceRange?.text ?? ([result.referenceRange?.low, result.referenceRange?.high].filter(value => value !== undefined).join(" to ") || "Not provided")}</dd></div><div><dt className="text-xs font-semibold text-[color:var(--muted-foreground)]">Trend</dt><dd className="mt-1 text-sm text-[color:var(--foreground)]">{result.trendLabel}</dd></div></dl>
                <div className="mt-4"><PatientStatusBadge label={result.reviewStatusLabel} /></div>
                <p className="mt-4 text-sm leading-6 text-[color:var(--muted-foreground)]">{result.whatItMayMean}</p>
                <Link to={`/portal/labs/${encodeURIComponent(result.id)}`} className="mt-4 inline-flex min-h-11 items-center gap-2 border-t border-[var(--border)] pt-3 text-sm font-semibold text-[color:var(--brand)] underline-offset-4 hover:underline">View result details<ArrowRight className="size-4" aria-hidden="true" /></Link>
              </article>
            ))}</div></section>;
          })}
        </div>
      )}
      <div className="mt-5"><SourceAndDate date={data.dataStatus.lastUpdatedAt} /></div>
    </div>
  );
}
