import { Activity, CheckCircle2, CircleDashed, Clock3, History, SearchCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SleSystemStatus } from "@/lib/sle-systems-review/types";

const STATUS_PRESENTATION = {
  "current-activity": { icon: Activity, variant: "purple" as const },
  "possible-activity": { icon: SearchCheck, variant: "purple" as const },
  "historical-involvement": { icon: History, variant: "info" as const },
  "no-current-evidence": { icon: CheckCircle2, variant: "success" as const },
  "assessment-incomplete": { icon: TriangleAlert, variant: "warning" as const },
  "monitoring-due": { icon: Clock3, variant: "warning" as const },
  "unable-to-determine": { icon: CircleDashed, variant: "neutral" as const },
};

export function SystemStatusBadge({ status, label }: { status: SleSystemStatus; label: string }) {
  const presentation = STATUS_PRESENTATION[status];
  const Icon = presentation.icon;
  return (
    <Badge variant={presentation.variant} className="whitespace-normal text-left leading-4" aria-label={`System status: ${label}`}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
