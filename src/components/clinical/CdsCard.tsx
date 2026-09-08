import { useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { RenalCdsCard as RenalCdsCardData } from "@/lib/renal-cds-card";

const INDICATOR_BADGE: Record<RenalCdsCardData["indicator"], { label: string; variant: "destructive" | "warning" | "info" }> = {
  critical: { label: "Critical", variant: "destructive" },
  warning: { label: "Warning", variant: "warning" },
  info: { label: "Info", variant: "info" },
};

const INDICATOR_BORDER: Record<RenalCdsCardData["indicator"], string> = {
  critical: "border-[#F2CBD1]",
  warning: "border-[var(--yellow)]",
  info: "border-[var(--info-border)]",
};

interface CdsCardProps {
  card: RenalCdsCardData;
  onDismiss?: (uuid: string) => void;
}

export function CdsCard({ card, onDismiss }: CdsCardProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const indicator = INDICATOR_BADGE[card.indicator];

  return (
    <Card className={INDICATOR_BORDER[card.indicator]}>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={indicator.variant}>{indicator.label}</Badge>
            <span className="text-sm font-semibold text-[color:var(--foreground)]">{card.summary}</span>
          </div>
          {onDismiss && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss card"
              onClick={() => onDismiss(card.uuid)}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        <p className="text-sm text-[color:var(--muted-foreground)]">{card.detail}</p>

        <p className="text-xs text-[#8592A3]">Source: {card.source.label}</p>

        {card.evidence.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setEvidenceOpen(v => !v)}
              className="flex items-center gap-1 text-xs font-medium text-[color:var(--brand)]"
              aria-expanded={evidenceOpen}
            >
              {evidenceOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              Evidence ({card.evidence.length})
            </button>
            {evidenceOpen && (
              <ul className="mt-2 space-y-1 border-l border-[var(--border)] pl-3 text-xs text-[color:var(--muted-foreground)]">
                {card.evidence.map((item, i) => (
                  <li key={`${item.label}-${item.date ?? i}`}>
                    {item.label}
                    {item.value !== undefined ? `: ${item.value}${item.unit ? ` ${item.unit}` : ""}` : ""}
                    {item.date ? ` (${item.date})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
