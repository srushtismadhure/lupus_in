import { AlertCircle, CircleDashed, DatabaseZap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PortalDataStatus } from "@/lib/patient-portal/client";

export function PortalLoadingState() {
  return <div role="status" aria-live="polite" className="flex min-h-40 items-center justify-center rounded-lg border border-[#DCE6F0] bg-white p-6 text-sm text-[#526172]"><span className="mr-3 size-5 animate-spin rounded-full border-2 border-[#B9DCF4] border-t-[#43205F] motion-reduce:animate-none" aria-hidden="true" />We are loading your health information.</div>;
}

export function PortalErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return <div role="alert" className="rounded-lg border border-[#F2CBD1] bg-[#FFF4F5] p-5"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 shrink-0 text-[#B63D4F]" aria-hidden="true" /><div><h2 className="font-semibold text-[#812D3B]">We could not load this part of your record.</h2><p className="mt-1 text-sm text-[#6B3A43]">{message ?? "Try again. If the problem continues, contact support."}</p><Button type="button" variant="outline" className="mt-4 min-h-11" onClick={onRetry}><RefreshCw aria-hidden="true" />Try again</Button></div></div></div>;
}

export function PortalEmptyState({ title = "No results are available for this section yet.", detail }: { title?: string; detail?: string }) {
  return <div className="rounded-lg border border-dashed border-[#BFCFDC] bg-white p-8 text-center"><CircleDashed className="mx-auto size-7 text-[#718096]" aria-hidden="true" /><h2 className="mt-3 font-semibold text-[#344253]">{title}</h2>{detail && <p className="mx-auto mt-1 max-w-xl text-sm text-[#5B6878]">{detail}</p>}</div>;
}

export function PortalIncompleteData({ status }: { status: PortalDataStatus }) {
  if (status.failedSections.length === 0 && status.incompleteSections.length === 0) return null;
  return <aside className="mb-5 rounded-lg border border-[#F0D49C] bg-[#FFF9EC] p-4" aria-label="Incomplete health information"><div className="flex items-start gap-3"><DatabaseZap className="mt-0.5 size-5 shrink-0 text-[#9A6418]" aria-hidden="true" /><div><h2 className="text-sm font-semibold text-[#6F4A13]">Some information is incomplete</h2><p className="mt-1 text-sm leading-6 text-[#755723]">Missing information is not treated as “normal” or “no concern.” {status.incompleteSections.length > 0 ? `Not available: ${status.incompleteSections.join(", ")}.` : ""} {status.failedSections.length > 0 ? `Could not retrieve: ${status.failedSections.join(", ")}.` : ""}</p></div></div></aside>;
}

export function SourceAndDate({ source = "Medical record", date }: { source?: string; date?: string }) {
  const formatted = date ? new Date(date) : null;
  return <p className="text-xs text-[#697586]">Source: {source}{formatted && !Number.isNaN(formatted.getTime()) ? ` · Updated ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(formatted)}` : ""}</p>;
}

