import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MNT_STATUS_LABELS, type MntQueueItem, type MntReferralStatus } from "@/lib/mnt-types";

function statusBadgeVariant(status: MntReferralStatus): "destructive" | "warning" | "info" | "success" | "neutral" {
  switch (status) {
    case "unable-to-reach-patient":
      return "destructive";
    case "awaiting-clinician-signature":
    case "scheduling-in-progress":
      return "warning";
    case "draft-prepared":
    case "referral-suggested":
    case "active-referral":
      return "info";
    case "appointment-scheduled":
    case "completed":
      return "success";
    default:
      return "neutral";
  }
}

export function MntReferralQueueTable({ items }: { items: MntQueueItem[] }) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <Card className="border-dashed bg-[#F3F9FD]">
        <CardContent className="text-center text-sm text-muted-foreground">
          No MNT referrals currently need attention.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#E4E7EC] text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Patient</th>
            <th className="px-4 py-3 font-medium">Referral reason</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Owner</th>
            <th className="px-4 py-3 font-medium">Days waiting</th>
            <th className="px-4 py-3 font-medium">Next action</th>
            <th className="px-4 py-3 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.patientId} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#EAF5FC]">
              <td className="px-4 py-3 font-medium text-foreground">{item.patientName}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.reasonText ?? "Not available"}</td>
              <td className="px-4 py-3">
                <Badge variant={statusBadgeVariant(item.status)}>{MNT_STATUS_LABELS[item.status]}</Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{item.ownerLabel}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.daysWaiting ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.nextAction}</td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant="outline" onClick={() => navigate(`/patients/${item.patientId}`)}>
                  Open Patient
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
