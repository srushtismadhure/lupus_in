import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CoordinationAppointment } from "@/lib/care-coordination/types";

function dateTime(value?: string): string {
  if (!value) return "Date not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function AppointmentsPanel({ appointments }: { appointments: CoordinationAppointment[] }) {
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b border-[var(--border)] px-4 py-4"><CardTitle className="flex items-center gap-2 text-sm"><CalendarDays className="size-4 text-[color:var(--link)]" aria-hidden="true" /> Upcoming appointments</CardTitle></CardHeader>
      <CardContent className="px-4 py-4">
        {appointments.length === 0 ? <p className="text-sm text-[color:var(--muted-foreground)]">No upcoming coordination appointments were found.</p> : (
          <ul className="space-y-3">
            {appointments.slice(0, 4).map(appointment => (
              <li key={appointment.id} className="rounded-md border border-[var(--border)] p-3">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{appointment.title}</p>
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">{dateTime(appointment.start)}</p>
                <p className="mt-1 text-xs font-medium capitalize text-[color:var(--link)]">{appointment.status}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

