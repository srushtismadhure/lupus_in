import { describe, expect, test } from "bun:test";
import { resolvePathologyImage } from "./renal-pathology-images";
import {
  ACTIVITY_LESION_KEYS,
  CHRONICITY_LESION_KEYS,
  MADISON_GRACE_PATIENT_ID,
  OLIVIA_BENNETT_PATIENT_ID,
  PATHOLOGY_REPORT_IDENTIFIER,
  SYNTHETIC_IDENTIFIER_SYSTEM,
  SYNTHETIC_NOTE,
  calculatePathologyIndex,
  isM32Code,
  resourceHasSyntheticIdentifier,
} from "./madison-class-iv-data";
import { upgradeMadisonClassIv, type FhirUpgradeClient } from "./madison-class-iv-upgrade";
import { buildRenalResponseModel, calculateKidneyReserve, OVERVIEW_HERO_METRICS } from "./renal-response";
import { sortDemoPatientViews } from "./worklist";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function subjectReference(resource: fhir4.Resource): string | undefined {
  return (resource as fhir4.Resource & { subject?: fhir4.Reference }).subject?.reference;
}

class MemoryFhirClient implements FhirUpgradeClient {
  private readonly store = new Map<string, fhir4.Resource[]>();
  private nextId = 1;

  constructor(resources: fhir4.Resource[]) {
    for (const resource of resources) {
      const bucket = this.store.get(resource.resourceType) ?? [];
      bucket.push(clone(resource));
      this.store.set(resource.resourceType, bucket);
    }
  }

  async search<T extends fhir4.Resource>(resourceType: T["resourceType"], query: string): Promise<T[]> {
    const params = new URLSearchParams(query);
    let resources = (this.store.get(resourceType) ?? []) as T[];
    const name = params.get("name")?.toLowerCase();
    if (name && resourceType === "Patient") {
      resources = resources.filter(resource => {
        const patient = resource as fhir4.Patient;
        return patient.name?.some(value => `${value.given?.join(" ") ?? ""} ${value.family ?? ""}`.trim().toLowerCase().includes(name)) ?? false;
      });
    }
    const patient = params.get("patient");
    if (patient) resources = resources.filter(resource => subjectReference(resource)?.endsWith(`/Patient/${patient}`) || subjectReference(resource) === `Patient/${patient}`);
    const subject = params.get("subject");
    if (subject) resources = resources.filter(resource => subjectReference(resource) === subject);
    const identifierToken = params.get("identifier");
    if (identifierToken !== null) {
      const separator = identifierToken.indexOf("|");
      const system = separator >= 0 ? identifierToken.slice(0, separator) : undefined;
      const value = separator >= 0 ? identifierToken.slice(separator + 1) : identifierToken;
      resources = resources.filter(resource => {
        const identifiers = (resource as T & { identifier?: fhir4.Identifier[] }).identifier;
        return identifiers?.some(identifier => (!system || identifier.system === system) && (!value || identifier.value === value)) ?? false;
      });
    }
    return clone(resources);
  }

  async create<T extends fhir4.Resource>(resourceType: T["resourceType"], resource: T): Promise<T> {
    const created = clone({ ...resource, id: `${resourceType.toLowerCase()}-${this.nextId++}`, meta: { versionId: "1" } } as T);
    const bucket = this.store.get(resourceType) ?? [];
    bucket.push(created);
    this.store.set(resourceType, bucket);
    return clone(created);
  }

  async update<T extends fhir4.Resource>(resourceType: T["resourceType"], id: string, resource: T, versionId?: string): Promise<T> {
    const bucket = this.store.get(resourceType) ?? [];
    const index = bucket.findIndex(item => item.id === id);
    if (index < 0) throw new Error(`Missing ${resourceType}/${id}`);
    const current = bucket[index]!;
    if (versionId && current.meta?.versionId !== versionId) throw new Error(`Version mismatch for ${resourceType}/${id}`);
    const nextVersion = String(Number(current.meta?.versionId ?? "0") + 1);
    const updated = clone({ ...resource, id, meta: { ...(resource.meta ?? {}), versionId: nextVersion } } as T);
    bucket[index] = updated;
    return clone(updated);
  }

  resources<T extends fhir4.Resource>(resourceType: T["resourceType"]): T[] {
    return clone((this.store.get(resourceType) ?? []) as T[]);
  }
}

function patient(id: string, given: string, family: string): fhir4.Patient {
  return { resourceType: "Patient", id, meta: { versionId: "1" }, active: true, name: [{ use: "official", given: [given], family }] };
}

function condition(id: string, patientId: string, code: string, text: string, verification: "confirmed" | "provisional"): fhir4.Condition {
  return {
    resourceType: "Condition",
    id,
    meta: { versionId: "1" },
    subject: { reference: `Patient/${patientId}` },
    code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10-cm", code }], text },
    clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
    verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: verification }] },
    onsetDateTime: code === "M32.14" ? "2026-07-15" : "2022-03-01",
    recordedDate: code === "M32.14" ? "2026-07-15" : "2022-03-05",
  };
}

function medication(id: string, name: string, start: string): fhir4.MedicationRequest {
  return {
    resourceType: "MedicationRequest",
    id,
    meta: { versionId: "1" },
    status: "active",
    intent: "order",
    medicationCodeableConcept: { text: name },
    subject: { reference: `Patient/${MADISON_GRACE_PATIENT_ID}` },
    authoredOn: start,
  };
}

function fixture(): MemoryFhirClient {
  const resources: fhir4.FhirResource[] = [
    patient(MADISON_GRACE_PATIENT_ID, "Madison", "Grace"),
    patient(OLIVIA_BENNETT_PATIENT_ID, "Olivia", "Bennett"),
    ...Array.from({ length: 15 }, (_, index) => patient(`other-${index + 1}`, `Demo${index + 1}`, "Patient")),
    condition("sle-madison", MADISON_GRACE_PATIENT_ID, "M32.9", "Systemic lupus erythematosus", "confirmed"),
    condition("ln-madison", MADISON_GRACE_PATIENT_ID, "M32.14", "Lupus nephritis (emerging / provisional)", "provisional"),
    condition("sle-olivia", OLIVIA_BENNETT_PATIENT_ID, "M32.9", "Systemic lupus erythematosus", "confirmed"),
    medication("hcq-existing", "Hydroxychloroquine", "2025-10-15"),
    medication("pred-existing", "Prednisone", "2026-04-15"),
    medication("mmf-existing", "Mycophenolate mofetil", "2026-07-15"),
    medication("mmf-duplicate", "Mycophenolate mofetil", "2026-07-22"),
    medication("lisinopril-existing", "Lisinopril", "2026-04-15"),
    {
      resourceType: "Observation",
      id: "old-current-egfr",
      meta: { versionId: "1" },
      status: "final",
      code: { coding: [{ system: "http://loinc.org", code: "98979-8" }], text: "eGFR (CKD-EPI 2021)" },
      subject: { reference: `Patient/${MADISON_GRACE_PATIENT_ID}` },
      effectiveDateTime: "2026-07-15",
      valueQuantity: { value: 57, unit: "mL/min/1.73 m2" },
    } satisfies fhir4.Observation,
  ];
  return new MemoryFhirClient(resources);
}

function modelResources(client: MemoryFhirClient): Parameters<typeof buildRenalResponseModel>[0] {
  return {
    patient: client.resources<fhir4.Patient>("Patient").find(item => item.id === MADISON_GRACE_PATIENT_ID)!,
    conditions: client.resources<fhir4.Condition>("Condition").filter(item => item.subject.reference === `Patient/${MADISON_GRACE_PATIENT_ID}`),
    diagnosticReports: client.resources<fhir4.DiagnosticReport>("DiagnosticReport"),
    observations: client.resources<fhir4.Observation>("Observation").filter(item => item.subject?.reference === `Patient/${MADISON_GRACE_PATIENT_ID}`),
    medicationRequests: client.resources<fhir4.MedicationRequest>("MedicationRequest").filter(item => item.subject.reference === `Patient/${MADISON_GRACE_PATIENT_ID}`),
    medicationAdministrations: client.resources<fhir4.MedicationAdministration>("MedicationAdministration"),
  };
}

describe("Madison Class IV data definitions", () => {
  test("pathology indices match their weighted lesion values", () => {
    expect(calculatePathologyIndex(ACTIVITY_LESION_KEYS)).toBe(12);
    expect(calculatePathologyIndex(CHRONICITY_LESION_KEYS)).toBe(3);
  });

  test("Class IV resolves to the existing class-four asset", () => {
    expect(resolvePathologyImage("IV")).toBeUndefined();
  });

  test("kidney reserve is 67% recovered with residual loss of 14", () => {
    const points = [96, 54, 63, 72, 78, 82].map((value, index) => ({
      date: String(index),
      value,
      provenance: { resourceType: "Observation", display: "eGFR", synthetic: true },
    }));
    const reserve = calculateKidneyReserve(points);
    expect(reserve?.recoveryPercentage).toBe(67);
    expect(reserve?.residualLoss).toBe(14);
  });

  test("the Overview contract contains exactly four hero metrics", () => {
    expect(OVERVIEW_HERO_METRICS).toEqual(["protein-leakage", "kidney-function", "renal-inflammation", "treatment"]);
  });

  test("Madison is first and Olivia is second in the demo patient order", () => {
    const views = [
      { patient: patient("other", "Zoe", "Example"), name: "Zoe Example" },
      { patient: patient(OLIVIA_BENNETT_PATIENT_ID, "Olivia", "Bennett"), name: "Olivia Bennett" },
      { patient: patient(MADISON_GRACE_PATIENT_ID, "Madison", "Grace"), name: "Madison Grace" },
    ] as never[];
    const sorted = sortDemoPatientViews(views);
    expect(sorted.map(view => view.patient.id)).toEqual([MADISON_GRACE_PATIENT_ID, OLIVIA_BENNETT_PATIENT_ID, "other"]);
  });
});

describe("Madison Class IV upgrade", () => {
  test("dry run plans the upgrade without writing", async () => {
    const client = fixture();
    const before = client.resources<fhir4.Patient>("Patient").length;
    const result = await upgradeMadisonClassIv(client, { dryRun: true });
    expect(result.writes).toBe(0);
    expect(result.patientCountBefore).toBe(before);
    expect(client.resources<fhir4.DiagnosticReport>("DiagnosticReport")).toHaveLength(0);
  });

  test("updates Madison in place, preserves Olivia, and is idempotent", async () => {
    const client = fixture();
    const patientsBefore = client.resources<fhir4.Patient>("Patient");
    const sleBefore = clone(client.resources<fhir4.Condition>("Condition").find(item => item.id === "sle-madison")!);
    const oliviaBefore = clone(client.resources<fhir4.Condition>("Condition").find(item => item.id === "sle-olivia")!);

    const first = await upgradeMadisonClassIv(client, { dryRun: false });
    expect(first.patientCountBefore).toBe(17);
    expect(first.patientCountAfter).toBe(17);
    expect(client.resources<fhir4.Patient>("Patient")).toHaveLength(patientsBefore.length);
    expect(client.resources<fhir4.Patient>("Patient").find(item => item.name?.[0]?.given?.[0] === "Madison")?.id).toBe(MADISON_GRACE_PATIENT_ID);
    expect(client.resources<fhir4.Condition>("Condition").find(item => item.id === "sle-madison")).toEqual(sleBefore);
    expect(client.resources<fhir4.Condition>("Condition").find(item => item.id === "sle-olivia")).toEqual(oliviaBefore);

    const lupusNephritis = client.resources<fhir4.Condition>("Condition").find(item => isM32Code(item, "M32.14"))!;
    expect(lupusNephritis.id).toBe("ln-madison");
    expect(lupusNephritis.verificationStatus?.coding?.[0]?.code).toBe("confirmed");
    expect(lupusNephritis.onsetDateTime).toBe("2025-07-15");
    expect(lupusNephritis.recordedDate).toBe("2026-07-15");
    expect(lupusNephritis.stage?.[0]?.summary?.coding?.[0]?.code).toBe("IV");

    const report = client.resources<fhir4.DiagnosticReport>("DiagnosticReport").find(item => resourceHasSyntheticIdentifier(item, PATHOLOGY_REPORT_IDENTIFIER))!;
    expect(lupusNephritis.stage?.[0]?.assessment?.[0]?.reference).toBe(`DiagnosticReport/${report.id}`);
    expect(lupusNephritis.evidence?.[0]?.detail?.[0]?.reference).toBe(`DiagnosticReport/${report.id}`);

    const model = buildRenalResponseModel(modelResources(client));
    expect(model.mode).toBe("renal-response");
    expect(model.activityIndex).toBe(12);
    expect(model.chronicityIndex).toBe(3);
    expect(model.kidneyReserve?.recoveryPercentage).toBe(67);
    expect(model.kidneyReserve?.residualLoss).toBe(14);
    expect(model.series.egfr?.points).toHaveLength(6);
    expect(model.series.upcr?.points.at(-1)?.value).toBe(0.6);
    expect(model.medications.filter(item => item.status === "active")).toHaveLength(5);
    expect(model.clinicalSummary.join(" ")).not.toContain("caused");

    const second = await upgradeMadisonClassIv(client, { dryRun: false });
    expect(second.created).toBe(0);
    const seeded = [
      ...client.resources<fhir4.Observation>("Observation"),
      ...client.resources<fhir4.DiagnosticReport>("DiagnosticReport"),
      ...client.resources<fhir4.MedicationRequest>("MedicationRequest"),
      ...client.resources<fhir4.MedicationAdministration>("MedicationAdministration"),
      ...client.resources<fhir4.Specimen>("Specimen"),
    ].filter(resource => resource.identifier?.some(identifier => identifier.system === SYNTHETIC_IDENTIFIER_SYSTEM));
    const identifiers = seeded.flatMap(resource =>
      resource.identifier?.filter(identifier => identifier.system === SYNTHETIC_IDENTIFIER_SYSTEM).map(identifier => identifier.value) ?? [],
    );
    expect(new Set(identifiers).size).toBe(identifiers.length);
    for (const resource of seeded) {
      const labeled =
        ("note" in resource && resource.note?.some(note => note.text?.includes("Synthetic"))) ||
        resource.extension?.some(extension => extension.url.includes("synthetic-data") && extension.valueBoolean === true);
      expect(labeled).toBe(true);
    }
    expect(second.patientCountAfter).toBe(17);
    expect(client.resources<fhir4.Condition>("Condition").filter(item => item.subject.reference === `Patient/${OLIVIA_BENNETT_PATIENT_ID}` && isM32Code(item, "M32.14"))).toHaveLength(0);
  });
});
