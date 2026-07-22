import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Accent = "purple" | "blue" | "amber" | "red" | "green" | "neutral";

const ACCENT_DOT: Record<Accent, string> = {
  purple: "bg-[#43205F]",
  blue: "bg-[#4F97C8]",
  amber: "bg-[#9A6418]",
  red: "bg-[#B63D4F]",
  green: "bg-[#2F7A4C]",
  neutral: "bg-[#6B7788]",
};

export function SummaryStatCard({ label, value, accent = "neutral" }: { label: string; value: number; accent?: Accent }) {
  return (
    <Card className="relative min-h-[104px] justify-between gap-2 overflow-hidden py-5">
      <span className={cn("absolute left-4 top-5 size-2.5 rounded-full", ACCENT_DOT[accent])} aria-hidden="true" />
      <CardHeader className="px-4 pl-9">
        <CardTitle className="text-xs font-semibold text-[#4F5E70]">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pl-9">
        <p className="text-3xl font-semibold text-[#1F2430]">{value}</p>
      </CardContent>
    </Card>
  );
}
