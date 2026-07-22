import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, CalendarDays, ClipboardList, FlaskConical, HeartPulse, House, MessageCircle, Pill } from "lucide-react";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";
import { PortalEmptyState, PortalErrorState, PortalIncompleteData, PortalLoadingState, SourceAndDate } from "@/components/patient-portal/PortalStates";
import { PatientStatusBadge } from "@/components/patient-portal/PatientStatusBadge";
import { UrgentHelp } from "@/components/patient-portal/UrgentHelp";
import { getPortalSummary } from "@/lib/patient-portal/client";
import { usePortalData } from "@/lib/patient-portal/use-portal-data";

function SummaryCard({ title, icon: Icon, children, to, linkLabel }: { title: string; icon: typeof House; children: React.ReactNode; to: string; linkLabel: string }) {
  return (
    <article className="flex min-h-[220px] flex-col rounded-lg border border-[#DCE6F0] bg-white p-5 shadow-[0_8px_22px_rgba(31,36,48,0.04)]">
      <h2 className="flex items-center gap-2 text-base font-semibold text-[#1F2430]"><Icon className="size-5 text-[#3577A2]" aria-hidden="true" />{title}</h2>
      <div className="mt-4 flex-1 text-sm text-[#526172]">{children}</div>
      <Link to={to} className="mt-4 inline-flex min-h-11 items-center gap-2 border-t border-[#E6ECF2] pt-3 text-sm font-semibold text-[#3F1D63] underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4F97C8]/40">{linkLabel}<ArrowRight className="size-4" aria-hidden="true" /></Link>
    </article>
  );
}

function dateTime(value?: string): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function PortalHomePage() {
  const loader = useCallback(() => getPortalSummary(), []);
  const { data, loading, error, retry } = usePortalData(loader);
  if (loading) return <PortalLoadingState />;
  if (error || !data) return <PortalErrorState message={error ?? undefined} onRetry={retry} />;
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  const dashboard = data.dashboard;
  return (
    <div>
      <PortalPageHeader title={`${greeting}, ${data.patient.firstName}`} subtitle="Here is what is happening with your lupus and kidney care." icon={House} />
      {data.patient.synthetic && <p className="mb-5 rounded-lg border border-[#C5E3F5] bg-[#EDF7FD] px-4 py-3 text-sm font-medium text-[#245D86]">This portal contains synthetic demonstration data, not a real patient record.</p>}
      <PortalIncompleteData status={data.dataStatus} />

      <section aria-labelledby="today-heading" className="mb-7">
        <h2 id="today-heading" className="text-lg font-semibold text-[#1F2430]">Today</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {dashboard.today.length === 0 ? <div className="lg:col-span-3"><PortalEmptyState title="No action is currently listed in your care plan." detail="You can still review your results, appointments, medicines, and messages." /></div> : dashboard.today.slice(0, 3).map(step => (
            <article key={step.id} className="rounded-lg border border-[#DCE6F0] bg-white p-4">
              <PatientStatusBadge label={step.status} />
              <h3 className="mt-3 font-semibold text-[#1F2430]">{step.title}</h3>
              <p className="mt-1 text-sm leading-6 text-[#526172]">{step.whyItMatters}</p>
              <dl className="mt-3 space-y-1 text-xs text-[#697586]"><div><dt className="inline font-semibold">Responsible: </dt><dd className="inline">{step.responsibleParty}</dd></div>{step.dueDate && <div><dt className="inline font-semibold">Due: </dt><dd className="inline">{dateTime(step.dueDate)}</dd></div>}{step.patientAction && <div><dt className="inline font-semibold">Your action: </dt><dd className="inline">{step.patientAction}</dd></div>}</dl>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="text-lg font-semibold text-[#1F2430]">Your care overview</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SummaryCard title="Kidney health" icon={HeartPulse} to="/portal/labs" linkLabel="View kidney results">
            <PatientStatusBadge label={dashboard.kidneyHealth.status} />
            <dl className="mt-4 grid grid-cols-2 gap-3"><div><dt className="text-xs font-semibold text-[#697586]">eGFR</dt><dd className="mt-1 font-semibold text-[#1F2430]">{dashboard.kidneyHealth.egfr ?? "Not available"}</dd></div><div><dt className="text-xs font-semibold text-[#697586]">Creatinine</dt><dd className="mt-1 font-semibold text-[#1F2430]">{dashboard.kidneyHealth.creatinine ?? "Not available"}</dd></div><div className="col-span-2"><dt className="text-xs font-semibold text-[#697586]">Urine protein</dt><dd className="mt-1 font-semibold text-[#1F2430]">{dashboard.kidneyHealth.urineProtein ?? "Not available"}</dd></div></dl>
          </SummaryCard>
          <SummaryCard title="Lupus overview" icon={Activity} to="/portal/lupus" linkLabel="View my lupus overview"><p className="text-3xl font-semibold text-[#1F2430]">{dashboard.lupusOverview.areasMonitored}</p><p className="mt-1">documented areas being monitored</p><p className="mt-4 font-medium text-[#344253]">{dashboard.lupusOverview.followUpStatus}</p></SummaryCard>
          <SummaryCard title="Next appointment" icon={CalendarDays} to="/portal/appointments" linkLabel="View appointments">{dashboard.nextAppointment ? <><p className="font-semibold text-[#1F2430]">{dashboard.nextAppointment.title}</p><p className="mt-2">{dateTime(dashboard.nextAppointment.start)}</p><p className="mt-1">{dashboard.nextAppointment.provider}</p><p className="mt-1">{dashboard.nextAppointment.location ?? dashboard.nextAppointment.organization ?? "Location not listed"}</p></> : <p>No upcoming appointment is available in your record.</p>}</SummaryCard>
          <SummaryCard title="Care-plan progress" icon={ClipboardList} to="/portal/care-plan" linkLabel="View my care plan"><p className="text-3xl font-semibold text-[#1F2430]">{dashboard.carePlan.activeSteps}</p><p className="mt-1">active step{dashboard.carePlan.activeSteps === 1 ? "" : "s"}</p><p className="mt-4 font-medium text-[#344253]">Next: {dashboard.carePlan.nextAction}</p><p className="mt-1">Coordinator: {dashboard.carePlan.coordinator}</p></SummaryCard>
          <SummaryCard title="Medications" icon={Pill} to="/portal/medications" linkLabel="View medications"><p className="text-3xl font-semibold text-[#1F2430]">{dashboard.medications.activeCount}</p><p className="mt-1">current medication{dashboard.medications.activeCount === 1 ? "" : "s"}</p><p className="mt-4">{dashboard.medications.monitoringItems} monitoring item{dashboard.medications.monitoringItems === 1 ? "" : "s"} listed</p></SummaryCard>
          <SummaryCard title="Messages" icon={MessageCircle} to="/portal/messages" linkLabel="Open messages"><p className="text-3xl font-semibold text-[#1F2430]">{dashboard.messages.unreadCount}</p><p className="mt-1">message{dashboard.messages.unreadCount === 1 ? "" : "s"} from your care team</p>{dashboard.messages.latestSubject && <p className="mt-4 font-medium text-[#344253]">Latest: {dashboard.messages.latestSubject}</p>}</SummaryCard>
        </div>
      </section>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.7fr]"><UrgentHelp /><div className="rounded-lg border border-[#DCE6F0] bg-white p-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><FlaskConical className="size-4 text-[#3577A2]" aria-hidden="true" />Record update</h2><SourceAndDate date={data.dataStatus.lastUpdatedAt} /><p className="mt-2 text-sm text-[#526172]">Your portal shows information currently available from your medical record. Ask your care team about anything that looks incomplete.</p></div></div>
    </div>
  );
}

