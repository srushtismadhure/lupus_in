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
      <Card className="border-dashed bg-[#F8FBFD]">
        <CardContent className="text-center text-sm font-medium text-[#4F5E70]">
          No MNT referrals currently need attention.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#DCE6F0] bg-[#F8FAFD] text-xs uppercase text-[#4F5E70]">
              <th className="px-5 py-3 font-semibold">Patient</th>
              <th className="px-5 py-3 font-semibold">Referral reason</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Owner</th>
              <th className="px-5 py-3 font-semibold">Days waiting</th>
              <th className="px-5 py-3 font-semibold">Next action</th>
              <th className="px-5 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.patientId} className="border-b border-[#E3EAF2] transition-colors last:border-0 hover:bg-[#F2F8FC]">
                <td className="px-5 py-4 font-semibold text-[#1F2430]">{item.patientName}</td>
                <td className="px-5 py-4 text-[#4F5E70]">{item.reasonText ?? "Not available"}</td>
                <td className="px-5 py-4">
                  <Badge variant={statusBadgeVariant(item.status)}>{MNT_STATUS_LABELS[item.status]}</Badge>
                </td>
                <td className="px-5 py-4 text-[#4F5E70]">{item.ownerLabel}</td>
                <td className="px-5 py-4 text-[#4F5E70]">{item.daysWaiting ?? "—"}</td>
                <td className="px-5 py-4 text-[#4F5E70]">{item.nextAction}</td>
                <td className="px-5 py-4 text-right">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/patients/${item.patientId}`)}>
                    Open Patient
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
