import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CoordinationBarrier } from "@/lib/care-coordination/types";

export function BarriersPanel({ barriers }: { barriers: CoordinationBarrier[] }) {
  const active = barriers.filter(barrier => barrier.status === "active");
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b border-[var(--border)] px-4 py-4"><CardTitle className="flex items-center gap-2 text-sm"><ShieldAlert className="size-4 text-[color:var(--warning-text)]" aria-hidden="true" /> Barriers and missing items</CardTitle></CardHeader>
      <CardContent className="px-4 py-4">
        {active.length === 0 ? <p className="text-sm text-[color:var(--muted-foreground)]">No active barriers are documented.</p> : (
          <ul className="space-y-3">
            {active.map(barrier => (
              <li key={barrier.id} className="rounded-md border border-[var(--yellow)] bg-[var(--warning-bg)] p-3">
                <p className="text-xs font-semibold uppercase text-[color:var(--warning-text)]">{barrier.category}</p>
                <p className="mt-1 text-sm text-[color:var(--warning-text)]">{barrier.description}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

