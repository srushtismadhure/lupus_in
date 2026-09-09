import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Accent = "purple" | "blue" | "amber" | "red" | "green" | "neutral";

const ACCENT_DOT: Record<Accent, string> = {
  purple: "bg-[var(--brand)]",
  blue: "bg-[var(--clinical-blue)]",
  amber: "bg-[var(--yellow)]",
  red: "bg-[#B63D4F]",
  green: "bg-[var(--mint)]",
  neutral: "bg-[var(--muted-foreground)]",
};

interface SummaryStatCardProps {
  label: string;
  value: number | string;
  accent?: Accent;
  actionLabel?: string;
  onAction?: () => void;
}

export function SummaryStatCard({ label, value, accent = "neutral", actionLabel, onAction }: SummaryStatCardProps) {
  return (
    <Card className="relative min-h-[116px] justify-between gap-2 overflow-hidden py-5">
      <span className={cn("absolute left-4 top-5 size-2.5 rounded-full", ACCENT_DOT[accent])} aria-hidden="true" />
      <CardHeader className="px-4 pl-9">
        <CardTitle className="text-xs font-semibold text-[color:var(--muted-foreground)]">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3 px-4 pl-9">
        <p className="text-3xl font-semibold text-[color:var(--foreground)]">{value}</p>
        {actionLabel && onAction && (
          <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
