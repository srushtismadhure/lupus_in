import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CoordinationBarrier } from "@/lib/care-coordination/types";

export function BarriersPanel({ barriers }: { barriers: CoordinationBarrier[] }) {
  const active = barriers.filter(barrier => barrier.status === "active");
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b border-[#E6ECF2] px-4 py-4"><CardTitle className="flex items-center gap-2 text-sm"><ShieldAlert className="size-4 text-[#9A6418]" aria-hidden="true" /> Barriers and missing items</CardTitle></CardHeader>
      <CardContent className="px-4 py-4">
        {active.length === 0 ? <p className="text-sm text-[#4F5E70]">No active barriers are documented.</p> : (
          <ul className="space-y-3">
            {active.map(barrier => (
              <li key={barrier.id} className="rounded-md border border-[#E6C784] bg-[#FFF9EB] p-3">
                <p className="text-xs font-semibold uppercase text-[#805110]">{barrier.category}</p>
                <p className="mt-1 text-sm text-[#4D391B]">{barrier.description}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

