import { CalendarDays, CheckCircle2, ClipboardList, Clock3, TriangleAlert } from "lucide-react";
import type { CareCoordinationSummary as Summary } from "@/lib/care-coordination/types";

const ITEMS = [
  { key: "activePathways", label: "Active pathways", icon: ClipboardList, accent: "border-t-[var(--primary)]" },
  { key: "pendingClinicianApprovals", label: "Pending clinician approvals", icon: Clock3, accent: "border-t-[var(--yellow)]" },
  { key: "overdueTasks", label: "Tasks overdue", icon: TriangleAlert, accent: "border-t-[#B63D4F]" },
  { key: "upcomingAppointments", label: "Upcoming appointments", icon: CalendarDays, accent: "border-t-[var(--primary)]" },
  { key: "closedPathways", label: "Closed pathways", icon: CheckCircle2, accent: "border-t-[var(--success)]" },
] as const;

export function CareCoordinationSummary({ summary }: { summary: Summary }) {
  return (
    <section aria-labelledby="coordination-summary-heading">
      <h2 id="coordination-summary-heading" className="sr-only">Care coordination summary</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {ITEMS.map(item => (
          <div key={item.key} className={`min-h-28 rounded-lg border border-[var(--border)] border-t-2 ${item.accent} bg-white p-4 shadow-[0_6px_18px_rgba(31,36,48,0.05)]`}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-[color:var(--muted-foreground)]">{item.label}</p>
              <item.icon className="size-4 text-[color:var(--muted-foreground)]" aria-hidden="true" />
            </div>
            <p className="mt-4 text-2xl font-semibold text-[color:var(--foreground)]">{summary[item.key]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

