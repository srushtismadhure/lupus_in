import { CircleHelp, Siren } from "lucide-react";
import { Link } from "react-router-dom";

export function UrgentHelp({ compact = false }: { compact?: boolean }) {
  return (
    <aside className="rounded-lg border border-[var(--border)] bg-white p-4" aria-labelledby="urgent-help-heading">
      <div className="flex items-start gap-3"><Siren className="mt-0.5 size-5 shrink-0 text-[color:var(--warning-text)]" aria-hidden="true" /><div><h2 id="urgent-help-heading" className="text-sm font-semibold text-[color:var(--foreground)]">Urgent and emergency help</h2><p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">Messages are not monitored for emergencies. For an emergency, contact your local emergency services now.</p>{!compact && <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">For a routine question or a concern that can wait for your care team, use secure Messages.</p>}<Link to="/portal/help" className="mt-2 inline-flex min-h-11 items-center gap-2 py-2 text-sm font-semibold text-[color:var(--brand)] underline decoration-[var(--sky-blue)] underline-offset-2"><CircleHelp className="size-4" aria-hidden="true" />See help options</Link></div></div>
    </aside>
  );
}

