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
  warning: "border-[#F5DAA7]",
  info: "border-[#C5E3F5]",
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
            <span className="text-sm font-semibold text-[#1F2430]">{card.summary}</span>
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

        <p className="text-sm text-[#4F5E70]">{card.detail}</p>

        <p className="text-xs text-[#8592A3]">Source: {card.source.label}</p>

        {card.evidence.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setEvidenceOpen(v => !v)}
              className="flex items-center gap-1 text-xs font-medium text-[#3F1D63]"
              aria-expanded={evidenceOpen}
            >
              {evidenceOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              Evidence ({card.evidence.length})
            </button>
            {evidenceOpen && (
              <ul className="mt-2 space-y-1 border-l border-[#DCE6F0] pl-3 text-xs text-[#4F5E70]">
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
