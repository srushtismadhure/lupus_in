import { useCallback } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, ClipboardList, MessageCircle, TriangleAlert } from "lucide-react";
import { PatientStatusBadge } from "@/components/patient-portal/PatientStatusBadge";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";
import { PortalEmptyState, PortalErrorState, PortalIncompleteData, PortalLoadingState, SourceAndDate } from "@/components/patient-portal/PortalStates";
import { Button } from "@/components/ui/button";
import { getPortalCarePlan } from "@/lib/patient-portal/client";
import { usePortalData } from "@/lib/patient-portal/use-portal-data";

function dateOnly(value?: string): string { if (!value) return "Not listed"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date); }

export function PortalCarePlanPage() {
  const loader = useCallback(() => getPortalCarePlan(), []);
  const { data, loading, error, retry } = usePortalData(loader);
  if (loading) return <PortalLoadingState />;
  if (error || !data) return <PortalErrorState message={error ?? undefined} onRetry={retry} />;
  return <div><PortalPageHeader title="My Care Plan" subtitle="See what is planned, what is in progress, and what you need to do next." icon={ClipboardList} /><PortalIncompleteData status={data.dataStatus} />
    {data.pathways.length === 0 ? <PortalEmptyState title="No action is currently listed in your care plan." detail="Transplant and dialysis planning are shown only when your care team has shared those pathways in the record." /> : <section className="space-y-4" aria-label="Care plan pathways">{data.pathways.map(pathway => <article key={pathway.id} className="rounded-lg border border-[#DCE6F0] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-[#1F2430]">{pathway.title}</h2><p className="mt-1 text-sm text-[#526172]">{pathway.purpose}</p></div><PatientStatusBadge label={pathway.statusLabel} /></div><dl className="mt-5 grid gap-4 border-y border-[#E6ECF2] py-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs font-semibold text-[#697586]">Next step</dt><dd className="mt-1 text-sm font-medium">{pathway.nextStep}</dd></div><div><dt className="text-xs font-semibold text-[#697586]">Responsible</dt><dd className="mt-1 text-sm font-medium">{pathway.responsibleParty}</dd></div><div><dt className="text-xs font-semibold text-[#697586]">Due date</dt><dd className="mt-1 text-sm font-medium">{dateOnly(pathway.dueDate)}</dd></div><div><dt className="text-xs font-semibold text-[#697586]">Destination</dt><dd className="mt-1 text-sm font-medium">{pathway.destination ?? "Not selected"}</dd></div></dl>{pathway.patientAction && <p className="mt-4 rounded-lg bg-[#EDF7FD] p-3 text-sm text-[#245D86]"><strong>Your action:</strong> {pathway.patientAction}</p>}<h3 className="mt-4 text-sm font-semibold">Progress</h3><ul className="mt-2 grid gap-2 sm:grid-cols-2">{pathway.milestones.map(item => <li key={item.label} className="flex items-center gap-2 text-sm text-[#526172]">{item.completed ? <CheckCircle2 className="size-4 shrink-0 text-[#2F7A4C]" aria-hidden="true" /> : <Circle className="size-4 shrink-0 text-[#7A8796]" aria-hidden="true" />}{item.label}<span className="sr-only">{item.completed ? "Completed" : "Not completed"}</span></li>)}</ul>{pathway.barriers.length > 0 && <div className="mt-4 rounded-lg border border-[#F0D49C] bg-[#FFF9EC] p-3"><p className="flex items-center gap-2 text-sm font-semibold text-[#6F4A13]"><TriangleAlert className="size-4" aria-hidden="true" />Current delays or missing items</p><ul className="mt-2 list-disc pl-5 text-sm text-[#755723]">{pathway.barriers.map(item => <li key={item}>{item}</li>)}</ul></div>}<Button asChild variant="outline" className="mt-4 min-h-11"><Link to="/portal/messages"><MessageCircle aria-hidden="true" />Ask for help</Link></Button></article>)}</section>}<div className="mt-5"><SourceAndDate date={data.dataStatus.lastUpdatedAt} /></div></div>;
}

