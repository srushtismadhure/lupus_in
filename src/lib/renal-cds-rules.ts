/**
 * Deterministic renal-monitoring rules engine. No LLM, no fuzzy inference — every
 * decision here traces to a specific configured threshold and specific FHIR
 * evidence. Thresholds below are DEMONSTRATION VALUES and require clinical
 * validation before any institutional use.
 */
import type { NormalizedRenalData, RenalMeasurement, RenalMeasurementType } from "./renal-cds-normalize";

export const renalRuleConfig = {
  version: "luppedin-renal-v1",
  monitoringWindowDays: 90,
  minimumDaysBetweenTrendValues: 7,
  alertOnMissingMonitoring: true,
  alertOnWorseningTrend: true,
  alertOnMissingFollowUp: true,
};

export type RenalRuleId = "monitoring-overdue" | "worsening-renal-trend" | "follow-up-incomplete";

export interface RenalFindingEvidence {
  label: string;
  value?: number;
  unit?: string;
  date?: string;
  resourceId?: string;
}

export interface RenalFinding {
  ruleId: RenalRuleId;
  indicator: "info" | "warning" | "critical";
  summary: string;
  detail: string;
  evidence: RenalFindingEvidence[];
  ruleVersion: string;
}

function latestByType(measurements: RenalMeasurement[], type: RenalMeasurementType): RenalMeasurement | undefined {
  const matches = measurements.filter(m => m.type === type);
  return matches[matches.length - 1];
}

function previousByType(measurements: RenalMeasurement[], type: RenalMeasurementType): RenalMeasurement | undefined {
  const matches = measurements.filter(m => m.type === type);
  return matches.length >= 2 ? matches[matches.length - 2] : undefined;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / (24 * 60 * 60 * 1000);
}

// --- Rule A: renal monitoring overdue ---
function evaluateMonitoringOverdue(data: NormalizedRenalData): RenalFinding | null {
  if (!renalRuleConfig.alertOnMissingMonitoring || !data.hasLupusNephritis) return null;

  const relevant = data.measurements.filter(m => m.type === "upcr" || m.type === "egfr" || m.type === "creatinine");
  const mostRecent = [...relevant].sort((a, b) => b.date.localeCompare(a.date))[0];

  const now = Date.now();
  const windowMs = renalRuleConfig.monitoringWindowDays * 24 * 60 * 60 * 1000;
  const overdue = !mostRecent || now - Date.parse(mostRecent.date) > windowMs;
  if (!overdue) return null;

  return {
    ruleId: "monitoring-overdue",
    indicator: "warning",
    summary: mostRecent
      ? `Renal monitoring overdue (last result ${mostRecent.date})`
      : "No renal monitoring results found",
    detail: mostRecent
      ? `The most recent renal laboratory result (${mostRecent.display ?? mostRecent.type.toUpperCase()}, ${mostRecent.value} ${mostRecent.unit}) was recorded on ${mostRecent.date}, more than ${renalRuleConfig.monitoringWindowDays} days ago.`
      : `No UPCR, eGFR, or creatinine result was found for this patient within the configured ${renalRuleConfig.monitoringWindowDays}-day monitoring window.`,
    evidence: mostRecent
      ? [{ label: mostRecent.display ?? mostRecent.type, value: mostRecent.value, unit: mostRecent.unit, date: mostRecent.date, resourceId: mostRecent.observationId }]
      : [],
    ruleVersion: renalRuleConfig.version,
  };
}

// --- Rule B: worsening renal trend ---
function evaluateWorseningTrend(data: NormalizedRenalData): RenalFinding | null {
  if (!renalRuleConfig.alertOnWorseningTrend) return null;

  const concerns: { type: RenalMeasurementType; latest: RenalMeasurement; previous: RenalMeasurement; direction: "up" | "down" }[] = [];

  for (const type of ["upcr", "egfr", "creatinine"] as const) {
    const latest = latestByType(data.measurements, type);
    const previous = previousByType(data.measurements, type);
    if (!latest || !previous) continue;
    if (daysBetween(latest.date, previous.date) < renalRuleConfig.minimumDaysBetweenTrendValues) continue;

    const increased = latest.value > previous.value;
    const decreased = latest.value < previous.value;
    const concerning = (type === "upcr" && increased) || (type === "creatinine" && increased) || (type === "egfr" && decreased);
    if (concerning) concerns.push({ type, latest, previous, direction: increased ? "up" : "down" });
  }

  if (concerns.length === 0) return null;

  const detailParts = concerns.map(c => {
    const label = c.latest.display ?? c.type.toUpperCase();
    const verb = c.direction === "up" ? "increased" : "declined";
    return `${label} ${verb} from ${c.previous.value} ${c.previous.unit} on ${c.previous.date} to ${c.latest.value} ${c.latest.unit} on ${c.latest.date}`;
  });

  const evidence: RenalFindingEvidence[] = concerns.flatMap(c => [
    { label: `${c.latest.display ?? c.type} (previous)`, value: c.previous.value, unit: c.previous.unit, date: c.previous.date, resourceId: c.previous.observationId },
    { label: `${c.latest.display ?? c.type} (latest)`, value: c.latest.value, unit: c.latest.unit, date: c.latest.date, resourceId: c.latest.observationId },
  ]);

  return {
    ruleId: "worsening-renal-trend",
    indicator: "warning",
    summary: "Worsening renal trend requires review",
    detail: `${detailParts.join(". ")}.`,
    evidence,
    ruleVersion: renalRuleConfig.version,
  };
}

// --- Rule C: incomplete follow-up ---
function evaluateIncompleteFollowUp(data: NormalizedRenalData, priorFindings: RenalFinding[]): RenalFinding | null {
  if (!renalRuleConfig.alertOnMissingFollowUp) return null;
  const hasConcern = priorFindings.some(f => f.ruleId === "monitoring-overdue" || f.ruleId === "worsening-renal-trend");
  if (!hasConcern) return null;
  if (data.tasks.length > 0) return null; // a relevant renal follow-up Task was found

  return {
    ruleId: "follow-up-incomplete",
    indicator: "warning",
    summary: "No documented renal follow-up identified",
    detail: "A renal monitoring concern was identified, but no relevant active or completed renal/nephrology follow-up Task was found for this patient.",
    evidence: [],
    ruleVersion: renalRuleConfig.version,
  };
}

export function evaluateRenalRules(data: NormalizedRenalData): RenalFinding[] {
  const findings: RenalFinding[] = [];

  const monitoring = evaluateMonitoringOverdue(data);
  if (monitoring) findings.push(monitoring);

  const trend = evaluateWorseningTrend(data);
  if (trend) findings.push(trend);

  const followUp = evaluateIncompleteFollowUp(data, findings);
  if (followUp) findings.push(followUp);

  return findings;
}
