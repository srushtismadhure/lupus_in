import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ATTENTION_REASON_LABELS, type WorklistPatientView } from "@/lib/worklist-types";

function reasonBadgeVariant(view: WorklistPatientView): "destructive" | "warning" | "info" | "neutral" {
  switch (view.primaryAttentionReason) {
    case "possible-worsening-renal-pattern":
      return "destructive";
    case "overdue-high-priority-task":
    case "proteinuria-monitoring-overdue":
      return "warning";
    case "requires-review":
    case "serology-change":
      return "info";
    default:
      return "neutral";
  }
}

function monitoringBadge(status: WorklistPatientView["monitoringStatus"]) {
  if (status === "overdue") return <Badge variant="warning">Overdue</Badge>;
  if (status === "insufficient-data") return <Badge variant="neutral">Insufficient data</Badge>;
  return <Badge variant="info">Current</Badge>;
}

function formatObservationCell(value: WorklistPatientView["latestUpcr"]): string {
  if (!value) return "Not available";
  return `${value.value}${value.unit ? ` ${value.unit}` : ""}`;
}

export function AttentionQueueTable({ patients }: { patients: WorklistPatientView[] }) {
  const navigate = useNavigate();

  if (patients.length === 0) {
    return (
      <Card className="border-dashed bg-[#F3F9FD]">
        <CardContent className="text-center text-sm text-muted-foreground">
          No patients currently require attention.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#E4E7EC] text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Priority</th>
            <th className="px-4 py-3 font-medium">Patient</th>
            <th className="px-4 py-3 font-medium">Reason flagged</th>
            <th className="px-4 py-3 font-medium">Latest UPCR</th>
            <th className="px-4 py-3 font-medium">Latest eGFR</th>
            <th className="px-4 py-3 font-medium">Monitoring</th>
            <th className="px-4 py-3 font-medium">Open tasks</th>
            <th className="px-4 py-3 font-medium">Last updated</th>
            <th className="px-4 py-3 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((view, index) => (
            <tr key={view.patient.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#EAF5FC]">
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{index + 1}</td>
              <td className="px-4 py-3 font-medium text-foreground">{view.name}</td>
              <td className="px-4 py-3">
                <Badge variant={reasonBadgeVariant(view)}>
                  {view.primaryAttentionReason ? ATTENTION_REASON_LABELS[view.primaryAttentionReason] : "—"}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{formatObservationCell(view.latestUpcr)}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatObservationCell(view.latestEgfr)}</td>
              <td className="px-4 py-3">{monitoringBadge(view.monitoringStatus)}</td>
              <td className="px-4 py-3 text-muted-foreground">{view.openTaskCount}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {view.lastUpdated ? new Date(view.lastUpdated).toLocaleDateString() : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant="outline" onClick={() => navigate(`/patients/${view.patient.id}`)}>
                  Review Patient
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
