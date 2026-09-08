import { useCallback } from "react";
import { Download, FileText } from "lucide-react";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";
import { PortalEmptyState, PortalErrorState, PortalIncompleteData, PortalLoadingState, SourceAndDate } from "@/components/patient-portal/PortalStates";
import { Button } from "@/components/ui/button";
import { getPortalDocuments } from "@/lib/patient-portal/client";
import { usePortalData } from "@/lib/patient-portal/use-portal-data";

function dateOnly(value?: string): string { if (!value) return "Date not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date); }

export function PortalDocumentsPage() {
  const loader = useCallback(() => getPortalDocuments(), []);
  const { data, loading, error, retry } = usePortalData(loader);
  if (loading) return <PortalLoadingState />;
  if (error || !data) return <PortalErrorState message={error ?? undefined} onRetry={retry} />;
  return <div><PortalPageHeader title="Documents" subtitle="View patient-safe documents and download a plain-language care summary." icon={FileText} action={<Button asChild className="min-h-11"><a href="/api/portal/documents/report" download="luppedin-care-summary.txt"><Download aria-hidden="true" />Download patient-friendly report</a></Button>} /><PortalIncompleteData status={data.dataStatus} /><aside className="mb-5 rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-4 text-sm leading-6 text-[color:var(--link)]">The generated summary separates information from your medical record, next steps, medicines, appointments, and general safety education. It does not include private staff notes or raw FHIR data.</aside>{data.documents.length === 0 ? <PortalEmptyState title="No patient-facing documents are available yet." /> : <section className="grid gap-4 md:grid-cols-2" aria-label="Patient documents">{data.documents.map(document => <article key={document.id} className="rounded-lg border border-[var(--border)] bg-white p-5"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--info-bg)] text-[color:var(--link)]"><FileText className="size-5" aria-hidden="true" /></span><div><h2 className="font-semibold text-[color:var(--foreground)]">{document.title}</h2><p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{document.category}</p></div></div><dl className="mt-4 grid gap-2 text-sm"><div><dt className="inline font-semibold">Date: </dt><dd className="inline text-[color:var(--muted-foreground)]">{dateOnly(document.date)}</dd></div><div><dt className="inline font-semibold">Source: </dt><dd className="inline text-[color:var(--muted-foreground)]">{document.source}</dd></div></dl>{document.description && <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">{document.description}</p>}{document.url ? <Button asChild variant="outline" className="mt-4 min-h-11"><a href={document.url}><Download aria-hidden="true" />Open document</a></Button> : <p className="mt-4 text-xs text-[color:var(--muted-foreground)]">A patient-safe download is not available for this record.</p>}</article>)}</section>}<div className="mt-5"><SourceAndDate date={data.dataStatus.lastUpdatedAt} /></div></div>;
}

