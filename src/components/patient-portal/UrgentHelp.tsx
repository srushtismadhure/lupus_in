import { CircleHelp, Siren } from "lucide-react";
import { Link } from "react-router-dom";

export function UrgentHelp({ compact = false }: { compact?: boolean }) {
  return (
    <aside className="rounded-lg border border-[#D7E3EC] bg-white p-4" aria-labelledby="urgent-help-heading">
      <div className="flex items-start gap-3"><Siren className="mt-0.5 size-5 shrink-0 text-[#9A6418]" aria-hidden="true" /><div><h2 id="urgent-help-heading" className="text-sm font-semibold text-[#1F2430]">Urgent and emergency help</h2><p className="mt-1 text-sm leading-6 text-[#526172]">Messages are not monitored for emergencies. For an emergency, contact your local emergency services now.</p>{!compact && <p className="mt-2 text-sm text-[#526172]">For a routine question or a concern that can wait for your care team, use secure Messages.</p>}<Link to="/portal/help" className="mt-2 inline-flex min-h-11 items-center gap-2 py-2 text-sm font-semibold text-[#3F1D63] underline decoration-[#78B7E3] underline-offset-2"><CircleHelp className="size-4" aria-hidden="true" />See help options</Link></div></div>
    </aside>
  );
}

