/** Consolidates renal findings into CDS Hooks cards — one card per finding is too noisy, but unrelated findings still get separate cards. */
import type { RenalFinding, RenalFindingEvidence, RenalRuleId } from "./renal-cds-rules";

export interface RenalCdsCard {
  uuid: string;
  summary: string;
  detail: string;
  indicator: "info" | "warning" | "critical";
  source: { label: string };
  ruleIds: RenalRuleId[];
  evidence: RenalFindingEvidence[];
}

const INDICATOR_PRIORITY: Record<RenalFinding["indicator"], number> = { critical: 0, warning: 1, info: 2 };

function highestIndicator(findings: RenalFinding[]): RenalFinding["indicator"] {
  return findings.reduce((worst, f) => (INDICATOR_PRIORITY[f.indicator] < INDICATOR_PRIORITY[worst] ? f.indicator : worst), "info" as RenalFinding["indicator"]);
}

/** Groups related findings (trend + its follow-up gap) into one card; monitoring-overdue-only stays separate since it's a distinct concern. */
export function buildRenalCdsCards(findings: RenalFinding[]): RenalCdsCard[] {
  if (findings.length === 0) return [];

  const trendRelated = findings.filter(f => f.ruleId === "worsening-renal-trend" || f.ruleId === "follow-up-incomplete");
  const monitoringOnly = findings.filter(f => f.ruleId === "monitoring-overdue");

  const cards: RenalCdsCard[] = [];

  if (trendRelated.length > 0) {
    const summary = trendRelated.some(f => f.ruleId === "worsening-renal-trend")
      ? "Worsening renal trend requires review"
      : "Renal follow-up incomplete";
    cards.push({
      uuid: crypto.randomUUID(),
      summary,
      detail: trendRelated.map(f => f.detail).join(" "),
      indicator: highestIndicator(trendRelated),
      source: { label: "LuppedIn Renal Monitoring" },
      ruleIds: trendRelated.map(f => f.ruleId),
      evidence: trendRelated.flatMap(f => f.evidence),
    });
  }

  if (monitoringOnly.length > 0) {
    cards.push({
      uuid: crypto.randomUUID(),
      summary: monitoringOnly[0]!.summary,
      detail: monitoringOnly.map(f => f.detail).join(" "),
      indicator: highestIndicator(monitoringOnly),
      source: { label: "LuppedIn Renal Monitoring" },
      ruleIds: monitoringOnly.map(f => f.ruleId),
      evidence: monitoringOnly.flatMap(f => f.evidence),
    });
  }

  return cards;
}
