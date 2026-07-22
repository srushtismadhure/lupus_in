import { describe, expect, test } from "bun:test";
import { CDS_SERVICES_DISCOVERY } from "./cds-hooks";
import { buildRenalCdsCards } from "./renal-cds-card";
import { normalizeRenalData } from "./renal-cds-normalize";
import { evaluateRenalRules, type RenalFinding } from "./renal-cds-rules";
import { handleCdsPatientView } from "../server/handlers";

function condition(text: string, icd10?: string): fhir4.Condition {
  return {
    resourceType: "Condition",
    id: crypto.randomUUID(),
    subject: { reference: "Patient/patient-1" },
    code: { text, coding: icd10 ? [{ system: "http://hl7.org/fhir/sid/icd-10-cm", code: icd10, display: text }] : undefined },
  };
}

const LOINC_DISPLAY: Record<string, string> = {
  "2890-2": "UPCR",
  "98979-8": "eGFR",
  "2160-0": "Serum creatinine",
};

function observation(loincCode: string, value: number, unit: string, date: string): fhir4.Observation {
  return {
    resourceType: "Observation",
    id: crypto.randomUUID(),
    status: "final",
    subject: { reference: "Patient/patient-1" },
    code: { coding: [{ system: "http://loinc.org", code: loincCode, display: LOINC_DISPLAY[loincCode] }], text: LOINC_DISPLAY[loincCode] },
    effectiveDateTime: date,
    valueQuantity: { value, unit },
  };
}

function task(status: fhir4.Task["status"], description: string): fhir4.Task {
  return {
    resourceType: "Task",
    id: crypto.randomUUID(),
    status,
    intent: "order",
    for: { reference: "Patient/patient-1" },
    description,
  };
}

const LOINC = { upcr: "2890-2", egfr: "98979-8", creatinine: "2160-0" };

describe("CDS Hooks discovery", () => {
  test("includes the luppedin-patient-view service with hook patient-view", () => {
    const service = CDS_SERVICES_DISCOVERY.services.find(s => s.id === "luppedin-patient-view");
    expect(service).toBeDefined();
    expect(service?.hook).toBe("patient-view");
  });
});

describe("handleCdsPatientView request validation", () => {
  test("rejects invalid JSON with 400", async () => {
    const req = new Request("http://localhost/cds-services/luppedin-patient-view", { method: "POST", body: "{not json" });
    const res = await handleCdsPatientView(req);
    expect(res.status).toBe(400);
  });

  test("rejects a hook that is not patient-view with 400", async () => {
    const req = new Request("http://localhost/cds-services/luppedin-patient-view", {
      method: "POST",
      body: JSON.stringify({ hook: "order-select", hookInstance: "abc", context: { patientId: "patient-1" } }),
    });
    const res = await handleCdsPatientView(req);
    expect(res.status).toBe(400);
  });

  test("rejects a missing hookInstance with 400", async () => {
    const req = new Request("http://localhost/cds-services/luppedin-patient-view", {
      method: "POST",
      body: JSON.stringify({ hook: "patient-view", context: { patientId: "patient-1" } }),
    });
    const res = await handleCdsPatientView(req);
    expect(res.status).toBe(400);
  });

  test("rejects a missing context.patientId with 400", async () => {
    const req = new Request("http://localhost/cds-services/luppedin-patient-view", {
      method: "POST",
      body: JSON.stringify({ hook: "patient-view", hookInstance: "abc", context: {} }),
    });
    const res = await handleCdsPatientView(req);
    expect(res.status).toBe(400);
  });
});

describe("normalizeRenalData", () => {
  test("classifies UPCR/eGFR/creatinine observations by LOINC code", () => {
    const observations = [
      observation(LOINC.upcr, 1.2, "mg/g", "2026-01-01"),
      observation(LOINC.egfr, 55, "mL/min/1.73m2", "2026-01-01"),
      observation(LOINC.creatinine, 1.1, "mg/dL", "2026-01-01"),
    ];
    const normalized = normalizeRenalData("patient-1", [], observations, []);
    expect(normalized.measurements).toHaveLength(3);
    expect(normalized.measurements.map(m => m.type).sort()).toEqual(["creatinine", "egfr", "upcr"]);
  });

  test("does not classify an unrelated observation as a renal measurement", () => {
    const unrelated = observation("1234-5", 98.6, "F", "2026-01-01");
    const normalized = normalizeRenalData("patient-1", [], [unrelated], []);
    expect(normalized.measurements).toHaveLength(0);
  });

  test("detects lupus nephritis via ICD-10 code", () => {
    const conditions = [condition("Lupus nephritis", "M32.14")];
    const normalized = normalizeRenalData("patient-1", conditions, [], []);
    expect(normalized.hasLupusNephritis).toBe(true);
  });

  test("does not flag generic SLE (no nephritis marker) as lupus nephritis", () => {
    const conditions = [condition("Systemic lupus erythematosus", "M32.9")];
    const normalized = normalizeRenalData("patient-1", conditions, [], []);
    expect(normalized.hasLupusNephritis).toBe(false);
    expect(normalized.hasLupus).toBe(true);
  });
});

describe("evaluateRenalRules", () => {
  const lupusNephritis = [condition("Lupus nephritis", "M32.14")];

  test("fires no rules when monitoring is recent, stable, and followed up", () => {
    const today = new Date().toISOString().slice(0, 10);
    const observations = [observation(LOINC.egfr, 60, "mL/min/1.73m2", today)];
    const tasks = [task("in-progress", "Renal follow-up")];
    const normalized = normalizeRenalData("patient-1", lupusNephritis, observations, tasks);
    const findings = evaluateRenalRules(normalized);
    expect(findings).toHaveLength(0);
  });

  test("fires monitoring-overdue when the most recent renal result is older than the configured window", () => {
    const observations = [observation(LOINC.egfr, 60, "mL/min/1.73m2", "2020-01-01")];
    const normalized = normalizeRenalData("patient-1", lupusNephritis, observations, []);
    const findings = evaluateRenalRules(normalized);
    expect(findings.some((f: RenalFinding) => f.ruleId === "monitoring-overdue")).toBe(true);
  });

  test("fires worsening-renal-trend when UPCR increases and eGFR decreases", () => {
    const observations = [
      observation(LOINC.upcr, 0.5, "mg/g", "2026-01-01"),
      observation(LOINC.upcr, 1.5, "mg/g", "2026-03-01"),
      observation(LOINC.egfr, 70, "mL/min/1.73m2", "2026-01-01"),
      observation(LOINC.egfr, 50, "mL/min/1.73m2", "2026-03-01"),
    ];
    const normalized = normalizeRenalData("patient-1", lupusNephritis, observations, []);
    const findings = evaluateRenalRules(normalized);
    const trend = findings.find((f: RenalFinding) => f.ruleId === "worsening-renal-trend");
    expect(trend).toBeDefined();
    expect(trend?.detail).toContain("UPCR");
    expect(trend?.detail).toContain("eGFR");
  });

  test("fires follow-up-incomplete when a concern exists but no renal Task is present", () => {
    const observations = [observation(LOINC.egfr, 60, "mL/min/1.73m2", "2020-01-01")];
    const normalized = normalizeRenalData("patient-1", lupusNephritis, observations, []);
    const findings = evaluateRenalRules(normalized);
    expect(findings.some((f: RenalFinding) => f.ruleId === "follow-up-incomplete")).toBe(true);
  });

  test("does not fire follow-up-incomplete when no concern exists in the first place", () => {
    const today = new Date().toISOString().slice(0, 10);
    const observations = [observation(LOINC.egfr, 60, "mL/min/1.73m2", today)];
    const normalized = normalizeRenalData("patient-1", lupusNephritis, observations, []);
    const findings = evaluateRenalRules(normalized);
    expect(findings.some((f: RenalFinding) => f.ruleId === "follow-up-incomplete")).toBe(false);
  });
});

describe("buildRenalCdsCards", () => {
  test("returns no cards for no findings", () => {
    expect(buildRenalCdsCards([])).toHaveLength(0);
  });

  test("groups worsening-trend and follow-up-incomplete findings into a single card", () => {
    const findings: RenalFinding[] = [
      { ruleId: "worsening-renal-trend", indicator: "warning", summary: "Worsening renal trend requires review", detail: "trend detail", evidence: [], ruleVersion: "v1" },
      { ruleId: "follow-up-incomplete", indicator: "warning", summary: "No documented renal follow-up identified", detail: "follow-up detail", evidence: [], ruleVersion: "v1" },
    ];
    const cards = buildRenalCdsCards(findings);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.detail).toContain("trend detail");
    expect(cards[0]?.detail).toContain("follow-up detail");
  });

  test("gives monitoring-overdue its own separate card", () => {
    const findings: RenalFinding[] = [
      { ruleId: "monitoring-overdue", indicator: "warning", summary: "Renal monitoring overdue", detail: "overdue detail", evidence: [], ruleVersion: "v1" },
      { ruleId: "worsening-renal-trend", indicator: "warning", summary: "Worsening renal trend requires review", detail: "trend detail", evidence: [], ruleVersion: "v1" },
    ];
    const cards = buildRenalCdsCards(findings);
    expect(cards).toHaveLength(2);
  });
});

describe("integration: FHIR resources -> normalize -> rules -> card", () => {
  test("a worsening lupus nephritis patient produces a valid CDS card end to end", () => {
    const conditions = [condition("Lupus nephritis", "M32.14")];
    const observations = [
      observation(LOINC.upcr, 0.4, "mg/g", "2026-01-01"),
      observation(LOINC.upcr, 2.1, "mg/g", "2026-04-01"),
      observation(LOINC.egfr, 75, "mL/min/1.73m2", "2026-01-01"),
      observation(LOINC.egfr, 42, "mL/min/1.73m2", "2026-04-01"),
    ];
    const tasks: fhir4.Task[] = [];

    const normalized = normalizeRenalData("patient-1", conditions, observations, tasks);
    const findings = evaluateRenalRules(normalized);
    const cards = buildRenalCdsCards(findings);

    expect(cards.length).toBeGreaterThan(0);
    const card = cards[0]!;
    expect(card.uuid).toBeTruthy();
    expect(card.summary).toBeTruthy();
    expect(["info", "warning", "critical"]).toContain(card.indicator);
    expect(card.source.label).toBe("LuppedIn Renal Monitoring");
  });
});
