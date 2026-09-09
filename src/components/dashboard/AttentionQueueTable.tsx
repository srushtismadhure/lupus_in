import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { WorklistPatientView } from "@/lib/worklist-types";

function reasonBadge(view: WorklistPatientView) {
  return <Badge variant={view.openTaskCount > 0 ? "warning" : "info"}>{view.openTaskCount > 0 ? "Follow-up needed" : "Review needed"}</Badge>;
}

export function AttentionQueueTable({ patients }: { patients: WorklistPatientView[] }) {
  const navigate = useNavigate();

  if (patients.length === 0) {
    return (
      <Card className="border-dashed bg-[var(--background)]">
        <CardContent className="text-center text-sm font-medium text-[color:var(--muted-foreground)]">
          No patients currently require attention.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--background)] text-xs uppercase text-[color:var(--muted-foreground)]">
              <th className="px-5 py-3 font-semibold">Priority</th>
              <th className="px-5 py-3 font-semibold">Patient</th>
              <th className="px-5 py-3 font-semibold">Reason flagged</th>
              <th className="px-5 py-3 font-semibold">Latest SpO₂</th>
              <th className="px-5 py-3 font-semibold">Dyspnea</th>
              <th className="px-5 py-3 font-semibold">Recent exacerbation</th>
              <th className="px-5 py-3 font-semibold">Open tasks</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((view, index) => (
              <tr key={view.patient.id} className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--blue-panel)]">
                <td className="px-5 py-4 font-mono text-xs text-[color:var(--muted-foreground)]">{index + 1}</td>
                <td className="px-5 py-4 font-semibold text-[color:var(--foreground)]">{view.name}</td>
                <td className="px-5 py-4">{reasonBadge(view)}</td>
                <td className="px-5 py-4 text-[color:var(--muted-foreground)]">Not available</td>
                <td className="px-5 py-4 text-[color:var(--muted-foreground)]">Not available</td>
                <td className="px-5 py-4 text-[color:var(--muted-foreground)]">Not available</td>
                <td className="px-5 py-4 text-[color:var(--muted-foreground)]">{view.openTaskCount}</td>
                <td className="px-5 py-4"><Badge variant={view.active ? "success" : "neutral"}>{view.active ? "Active" : "Inactive"}</Badge></td>
                <td className="px-5 py-4 text-right">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/patients/${view.patient.id}`)}>
                    Review Patient
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
