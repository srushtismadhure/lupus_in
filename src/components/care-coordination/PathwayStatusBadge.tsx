import { CircleCheck, CircleDashed, Clock3, PauseCircle, Send, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CarePathwayStatus } from "@/lib/care-coordination/types";

const LABELS: Record<CarePathwayStatus, string> = {
  suggested: "Suggested",
  "awaiting-clinician-review": "Requires clinician review",
  approved: "Approved",
  "referral-sent": "Referral sent",
  scheduling: "Scheduling",
  scheduled: "Scheduled",
  "in-progress": "In progress",
  completed: "Completed",
  closed: "Closed",
  declined: "Not moving forward",
  deferred: "Deferred",
  blocked: "Blocked",
};

export function PathwayStatusBadge({ status }: { status: CarePathwayStatus }) {
  const Icon =
    status === "completed" || status === "closed"
      ? CircleCheck
      : status === "blocked"
        ? TriangleAlert
        : status === "deferred" || status === "declined"
          ? PauseCircle
          : status === "referral-sent"
            ? Send
            : status === "suggested" || status === "awaiting-clinician-review"
              ? Clock3
              : CircleDashed;
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        (status === "completed" || status === "closed") && "border-[#B9DDC6] bg-[#EAF5EE] text-[#245E3C]",
        status === "blocked" && "border-[#E9B7BF] bg-[#FCEBED] text-[#8B2D3B]",
        (status === "deferred" || status === "declined") && "border-[#D7DEE7] bg-[#EEF2F6] text-[#445160]",
        (status === "awaiting-clinician-review" || status === "suggested") && "border-[#E6C784] bg-[#FFF4DD] text-[#805110]",
        !["completed", "closed", "blocked", "deferred", "declined", "awaiting-clinician-review", "suggested"].includes(status) &&
          "border-[#B7D9EF] bg-[#EDF7FD] text-[#245D86]",
      )}
      aria-label={`Pathway status: ${LABELS[status]}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}

