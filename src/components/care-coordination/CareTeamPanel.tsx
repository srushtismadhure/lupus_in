import { UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CareTeamMember } from "@/lib/care-coordination/types";

export function CareTeamPanel({ members }: { members: CareTeamMember[] }) {
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b border-[var(--border)] px-4 py-4">
        <CardTitle className="flex items-center gap-2 text-sm"><UsersRound className="size-4 text-[color:var(--primary)]" aria-hidden="true" /> Care team</CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-4">
        {members.length === 0 ? (
          <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">No patient-specific CareTeam participants were available. Ownership remains explicitly unassigned.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {members.map(member => (
              <li key={member.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{member.name}</p>
                <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{member.role}{member.organization ? ` · ${member.organization}` : ""}</p>
                <p className="mt-1 text-xs font-medium text-[color:var(--link)]">{member.openTaskCount} open {member.openTaskCount === 1 ? "Task" : "Tasks"}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

