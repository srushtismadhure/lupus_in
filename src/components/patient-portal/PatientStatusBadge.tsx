import { CheckCircle2, CircleDashed, Clock3, Info, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PatientStatusBadge({ label }: { label: string }) {
  const text = label.toLowerCase();
  const isWaiting = text.includes("waiting") || text.includes("pending") || text.includes("scheduling") || text.includes("review");
  const isIncomplete = text.includes("not complete") || text.includes("incomplete") || text.includes("outside") || text.includes("due") || text.includes("delayed") || text.includes("missing") || text.includes("not enough");
  const isUnavailable = text.includes("unable") || text.includes("unavailable");
  const isComplete = !isIncomplete && !isWaiting && (text.includes("within") || text.includes("reviewed") || text.includes("complete") || text === "approved" || text === "scheduled");
  const Icon = isIncomplete ? TriangleAlert : isWaiting ? Clock3 : isUnavailable ? CircleDashed : isComplete ? CheckCircle2 : Info;
  const variant = isIncomplete ? "warning" as const : isWaiting ? "info" as const : isComplete ? "success" as const : "neutral" as const;
  return <Badge variant={variant} className="whitespace-normal text-left leading-4" aria-label={`Status: ${label}`}><Icon aria-hidden="true" />{label}</Badge>;
}
