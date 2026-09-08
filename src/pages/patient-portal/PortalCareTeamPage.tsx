import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Building2, MessageCircle, Users } from "lucide-react";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";
import { PortalEmptyState, PortalErrorState, PortalIncompleteData, PortalLoadingState, SourceAndDate } from "@/components/patient-portal/PortalStates";
import { Button } from "@/components/ui/button";
import { getPortalCareTeam } from "@/lib/patient-portal/client";
import { usePortalData } from "@/lib/patient-portal/use-portal-data";

export function PortalCareTeamPage() {
  const loader = useCallback(() => getPortalCareTeam(), []);
  const { data, loading, error, retry } = usePortalData(loader);
  if (loading) return <PortalLoadingState />;
  if (error || !data) return <PortalErrorState message={error ?? undefined} onRetry={retry} />;
  return <div><PortalPageHeader title="My Care Team" subtitle="See who is involved in your documented care plan and how they help." icon={Users} /><PortalIncompleteData status={data.dataStatus} />{data.members.length === 0 ? <PortalEmptyState title="No care-team members are available in this record yet." detail="This does not mean you do not have a care team. Ask your clinic if this list looks incomplete." /> : <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Care team members">{data.members.map(member => <article key={member.id} className="flex flex-col rounded-lg border border-[var(--border)] bg-white p-5"><div className="flex size-11 items-center justify-center rounded-lg bg-[var(--info-bg)] text-[color:var(--link)]"><Users className="size-5" aria-hidden="true" /></div><h2 className="mt-4 font-semibold text-[color:var(--foreground)]">{member.name}</h2><p className="mt-1 text-sm font-medium text-[color:var(--brand)]">{member.role}</p>{member.organization && <p className="mt-2 flex items-center gap-2 text-sm text-[color:var(--muted-foreground)]"><Building2 className="size-4" aria-hidden="true" />{member.organization}</p>}<p className="mt-4 text-sm leading-6 text-[color:var(--muted-foreground)]">{member.howTheyHelp}</p>{member.currentInvolvement.length > 0 && <div className="mt-4"><h3 className="text-sm font-semibold">Current involvement</h3><ul className="mt-1 list-disc pl-5 text-sm text-[color:var(--muted-foreground)]">{member.currentInvolvement.map(item => <li key={item}>{item}</li>)}</ul></div>}<div className="mt-auto pt-4">{member.canMessage && <Button asChild variant="outline" className="min-h-11 w-full"><Link to="/portal/messages"><MessageCircle aria-hidden="true" />Send secure message</Link></Button>}</div></article>)}</section>}<div className="mt-5"><SourceAndDate date={data.dataStatus.lastUpdatedAt} /></div></div>;
}

