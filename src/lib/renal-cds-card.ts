/** Builds patient-view CDS cards from deterministic findings. */
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
  return findings.reduce(
    (worst, finding) => (INDICATOR_PRIORITY[finding.indicator] < INDICATOR_PRIORITY[worst] ? finding.indicator : worst),
    "info" as RenalFinding["indicator"],
  );
}

export function buildRenalCdsCards(findings: RenalFinding[]): RenalCdsCard[] {
  if (findings.length === 0) return [];

  const homeHealthMedication = findings.filter(f => f.ruleId === "home-health-medication-review");
  const trendRelated = findings.filter(f => f.ruleId === "worsening-renal-trend" || f.ruleId === "follow-up-incomplete");
  const monitoringOnly = findings.filter(f => f.ruleId === "monitoring-overdue");
  const cards: RenalCdsCard[] = [];

  if (homeHealthMedication.length > 0) {
    cards.push({
      uuid: crypto.randomUUID(),
      summary: homeHealthMedication[0]!.summary,
      detail: homeHealthMedication.map(f => f.detail).join(" "),
      indicator: highestIndicator(homeHealthMedication),
      source: { label: "Waypoint COPD Medication Safety" },
      ruleIds: homeHealthMedication.map(f => f.ruleId),
      evidence: homeHealthMedication.flatMap(f => f.evidence),
    });
  }

  if (trendRelated.length > 0) {
    const summary = trendRelated.some(f => f.ruleId === "worsening-renal-trend")
      ? "Worsening renal trend requires review"
      : "Renal follow-up incomplete";
    cards.push({
      uuid: crypto.randomUUID(),
      summary,
      detail: trendRelated.map(f => f.detail).join(" "),
      indicator: highestIndicator(trendRelated),
      source: { label: "Waypoint Clinical Monitoring" },
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
      source: { label: "Waypoint Clinical Monitoring" },
      ruleIds: monitoringOnly.map(f => f.ruleId),
      evidence: monitoringOnly.flatMap(f => f.evidence),
    });
  }

  return cards.slice(0, 3);
}
