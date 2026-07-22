import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Accent = "purple" | "blue" | "amber" | "red" | "green" | "neutral";

const ACCENT_BORDER: Record<Accent, string> = {
  purple: "border-t-[#3F1D63]",
  blue: "border-t-[#78B7E3]",
  amber: "border-t-[#D3932E]",
  red: "border-t-[#C84F5C]",
  green: "border-t-[#4F9468]",
  neutral: "border-t-[#E4E7EC]",
};

export function SummaryStatCard({ label, value, accent = "neutral" }: { label: string; value: number; accent?: Accent }) {
  return (
    <Card className={cn("border-t-2 gap-2 py-4", ACCENT_BORDER[accent])}>
      <CardHeader className="px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
