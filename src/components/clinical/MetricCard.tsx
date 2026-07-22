import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getObservationEffectiveDate, getObservationInterpretation, type TrendDirection } from "@/lib/fhir-observations";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  accent?: "purple" | "blue";
  value?: string;
  unit?: string;
  observation?: fhir4.Observation;
  previousValue?: string;
  trend?: TrendDirection;
}

function TrendIndicator({ trend }: { trend?: TrendDirection }) {
  if (!trend) return null;
  if (trend === "unchanged") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3" /> Unchanged
      </span>
    );
  }
  const Icon = trend === "up" ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="size-3" /> {trend === "up" ? "Increased" : "Decreased"} vs. previous
    </span>
  );
}

export function MetricCard({ title, accent = "purple", value, unit, observation, previousValue, trend }: MetricCardProps) {
  const hasValue = value !== undefined;
  const effectiveDate = observation ? getObservationEffectiveDate(observation) : undefined;
  const interpretation = observation ? getObservationInterpretation(observation) : undefined;

  return (
    <Card className={cn("border-t-2", accent === "purple" ? "border-t-[#3F1D63]" : "border-t-[#78B7E3]")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {hasValue ? (
          <>
            <p className="text-2xl font-semibold text-foreground">
              {value}
              {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
            </p>
            <div className="mt-1 space-y-0.5">
              {effectiveDate && <p className="text-xs text-muted-foreground">As of {effectiveDate}</p>}
              {interpretation && <p className="text-xs text-muted-foreground">{interpretation}</p>}
              {previousValue && <p className="text-xs text-muted-foreground">Previous: {previousValue}</p>}
              <TrendIndicator trend={trend} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Not available</p>
        )}
      </CardContent>
    </Card>
  );
}
