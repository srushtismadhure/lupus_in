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
      <CardHeader className="border-b border-[#E6ECF2] px-4 py-4"><CardTitle className="flex items-center gap-2 text-sm"><CalendarDays className="size-4 text-[#245D86]" aria-hidden="true" /> Upcoming appointments</CardTitle></CardHeader>
      <CardContent className="px-4 py-4">
        {appointments.length === 0 ? <p className="text-sm text-[#4F5E70]">No upcoming coordination appointments were found.</p> : (
          <ul className="space-y-3">
            {appointments.slice(0, 4).map(appointment => (
              <li key={appointment.id} className="rounded-md border border-[#E3EAF2] p-3">
                <p className="text-sm font-semibold text-[#1F2430]">{appointment.title}</p>
                <p className="mt-1 text-xs text-[#4F5E70]">{dateTime(appointment.start)}</p>
                <p className="mt-1 text-xs font-medium capitalize text-[#245D86]">{appointment.status}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

