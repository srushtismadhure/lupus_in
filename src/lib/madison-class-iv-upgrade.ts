import { formatPatientName, referencesPatient } from "./formatters.js";
import {
  BIOPSY_SPECIMEN_IDENTIFIER,
  LONGITUDINAL_METRICS,
  MADISON_GRACE_NAME,
  MADISON_GRACE_PATIENT_ID,
  MEDICATION_SEEDS,
  METHYLPREDNISOLONE_DATES,
  PATHOLOGY_FINDINGS,
  PATHOLOGY_REPORT_IDENTIFIER,
  RENAL_DATES,
  SYNTHETIC_IDENTIFIER_SYSTEM,
  SYNTHETIC_NOTE,
  buildBiopsySpecimen,
  buildConfirmedClassIvCondition,
  buildLongitudinalObservation,
  buildMedicationRequest,
  buildMethylprednisoloneAdministration,
  buildPathologyObservation,
  buildPathologyReport,
  isM32Code,
  longitudinalObservationIdentifier,
  methylprednisoloneIdentifier,
  pathologyObservationIdentifier,
  resourceHasSyntheticIdentifier,
  type LongitudinalMetricDefinition,
  type MedicationSeedDefinition,
  type RenalDate,
} from "./madison-class-iv-data.js";

type SeededResource =
  | fhir4.Specimen
  | fhir4.Observation
  | fhir4.DiagnosticReport
  | fhir4.MedicationRequest
  | fhir4.MedicationAdministration;

export interface FhirUpgradeClient {
  search<T extends fhir4.Resource>(resourceType: T["resourceType"], query: string): Promise<T[]>;
  create<T extends fhir4.Resource>(resourceType: T["resourceType"], resource: T): Promise<T>;
  update<T extends fhir4.Resource>(resourceType: T["resourceType"], id: string, resource: T, versionId?: string): Promise<T>;
}

export type UpgradeActionKind = "create" | "update" | "reconcile";

export interface UpgradeAction {
  kind: UpgradeActionKind;
  resourceType: string;
  label: string;
  identifier?: string;
  existingId?: string;
}

export interface MadisonUpgradeResult {
  dryRun: boolean;
  patientId: string;
  patientCountBefore: number;
  patientCountAfter: number;
  lupusNephritisConditionId: string;
  sleConditionId: string;
  actions: UpgradeAction[];
  writes: number;
  skippedAsCurrent: number;
  created: number;
  updated: number;
}

interface UpgradeOptions {
  dryRun: boolean;
  logger?: (message: string) => void;
}

interface Inventory {
  patient: fhir4.Patient;
  patientCount: number;
  sleCondition: fhir4.Condition;
  lupusNephritisCondition: fhir4.Condition;
  observations: fhir4.Observation[];
  reports: fhir4.DiagnosticReport[];
  medicationRequests: fhir4.MedicationRequest[];
  medicationAdministrations: fhir4.MedicationAdministration[];
  specimens: fhir4.Specimen[];
  seeded: {
    Observation: fhir4.Observation[];
    DiagnosticReport: fhir4.DiagnosticReport[];
    MedicationRequest: fhir4.MedicationRequest[];
    MedicationAdministration: fhir4.MedicationAdministration[];
    Specimen: fhir4.Specimen[];
  };
}

interface PlannedUpsert<T extends SeededResource> {
  resourceType: T["resourceType"];
  identifier: string;
  label: string;
  existing?: T;
}

interface MedicationPlan extends PlannedUpsert<fhir4.MedicationRequest> {
  seed: MedicationSeedDefinition;
  duplicateResources: fhir4.MedicationRequest[];
}

function exactPatientName(patient: fhir4.Patient): boolean {
  return formatPatientName(patient).trim().toLowerCase() === MADISON_GRACE_NAME.toLowerCase();
}

function requireOne<T>(items: T[], label: string): T {
  if (items.length !== 1) throw new Error(`Expected exactly one ${label}; found ${items.length}. No data was changed.`);
  return items[0]!;
}

function resourceDate(resource: fhir4.Observation): string | undefined {
  return (resource.effectiveDateTime ?? resource.effectivePeriod?.start ?? resource.issued)?.slice(0, 10);
}

function medicationText(resource: fhir4.MedicationRequest): string {
  return (
    resource.medicationCodeableConcept?.text ??
    resource.medicationCodeableConcept?.coding?.[0]?.display ??
    resource.medicationCodeableConcept?.coding?.[0]?.code ??
    ""
  );
}

function hasCode(resource: fhir4.Observation, metric: LongitudinalMetricDefinition): boolean {
  return resource.code.coding?.some(coding => coding.code === metric.code && (!coding.system || coding.system === metric.codeSystem)) ?? false;
}

function seededMatch<T extends SeededResource>(resources: T[], identifier: string, patientId: string): T | undefined {
  const matches = resources.filter(resource => {
    if (!resourceHasSyntheticIdentifier(resource, identifier)) return false;
    if (resource.resourceType === "Specimen") return resource.subject ? referencesPatient(resource.subject, patientId) : false;
    if ("subject" in resource) return referencesPatient(resource.subject, patientId);
    return false;
  });
  if (matches.length > 1) throw new Error(`Multiple ${matches[0]?.resourceType ?? "FHIR"} resources use synthetic identifier ${identifier}. No data was changed.`);
  return matches[0];
}

function normalizeForComparison(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForComparison);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    if (key === "id" || key === "meta" || key === "text") continue;
    const normalized = normalizeForComparison(record[key]);
    if (normalized !== undefined) result[key] = normalized;
  }
  return result;
}

function resourcesEquivalent(current: fhir4.Resource, desired: fhir4.Resource): boolean {
  return JSON.stringify(normalizeForComparison(current)) === JSON.stringify(normalizeForComparison(desired));
}

async function loadInventory(client: FhirUpgradeClient): Promise<Inventory> {
  const [allPatients, namedPatients] = await Promise.all([
    client.search<fhir4.Patient>("Patient", "_count=100"),
    client.search<fhir4.Patient>("Patient", `name=${encodeURIComponent(MADISON_GRACE_NAME)}&_count=20`),
  ]);
  const patient = requireOne(namedPatients.filter(exactPatientName), `Patient named ${MADISON_GRACE_NAME}`);
  if (!patient.id) throw new Error("Madison Grace has no Patient.id. No data was changed.");
  if (patient.id !== MADISON_GRACE_PATIENT_ID) {
    throw new Error(`Madison Grace resolved to unexpected Patient.id ${patient.id}; expected ${MADISON_GRACE_PATIENT_ID}. No data was changed.`);
  }

  const patientId = patient.id;
  const [conditions, observations, reports, medicationRequests, medicationAdministrations, specimens, seededObservations, seededReports, seededRequests, seededAdministrations, seededSpecimens] =
    await Promise.all([
      client.search<fhir4.Condition>("Condition", `patient=${encodeURIComponent(patientId)}&_count=100`),
      client.search<fhir4.Observation>("Observation", `patient=${encodeURIComponent(patientId)}&_count=200`),
      client.search<fhir4.DiagnosticReport>("DiagnosticReport", `patient=${encodeURIComponent(patientId)}&_count=100`),
      client.search<fhir4.MedicationRequest>("MedicationRequest", `patient=${encodeURIComponent(patientId)}&_count=100`),
      client.search<fhir4.MedicationAdministration>("MedicationAdministration", `patient=${encodeURIComponent(patientId)}&_count=100`),
      client.search<fhir4.Specimen>("Specimen", `subject=${encodeURIComponent(`Patient/${patientId}`)}&_count=100`),
      client.search<fhir4.Observation>("Observation", `identifier=${encodeURIComponent(`${SYNTHETIC_IDENTIFIER_SYSTEM}|`)}&_count=200`),
      client.search<fhir4.DiagnosticReport>("DiagnosticReport", `identifier=${encodeURIComponent(`${SYNTHETIC_IDENTIFIER_SYSTEM}|`)}&_count=100`),
      client.search<fhir4.MedicationRequest>("MedicationRequest", `identifier=${encodeURIComponent(`${SYNTHETIC_IDENTIFIER_SYSTEM}|`)}&_count=100`),
      client.search<fhir4.MedicationAdministration>("MedicationAdministration", `identifier=${encodeURIComponent(`${SYNTHETIC_IDENTIFIER_SYSTEM}|`)}&_count=100`),
      client.search<fhir4.Specimen>("Specimen", `identifier=${encodeURIComponent(`${SYNTHETIC_IDENTIFIER_SYSTEM}|`)}&_count=100`),
    ]);

  const sleCondition = requireOne(conditions.filter(condition => isM32Code(condition, "M32.9")), "Madison M32.9 SLE Condition");
  const lupusNephritisCondition = requireOne(conditions.filter(condition => isM32Code(condition, "M32.14")), "Madison M32.14 lupus-nephritis Condition");
  if (!sleCondition.id || !lupusNephritisCondition.id) throw new Error("Madison's required Conditions do not have IDs. No data was changed.");

  return {
    patient,
    patientCount: allPatients.length,
    sleCondition,
    lupusNephritisCondition,
    observations,
    reports,
    medicationRequests,
    medicationAdministrations,
    specimens,
    seeded: {
      Observation: seededObservations,
      DiagnosticReport: seededReports,
      MedicationRequest: seededRequests,
      MedicationAdministration: seededAdministrations,
      Specimen: seededSpecimens,
    },
  };
}

function planObservation(
  inventory: Inventory,
  metric: LongitudinalMetricDefinition,
  date: RenalDate,
): PlannedUpsert<fhir4.Observation> {
  const identifier = longitudinalObservationIdentifier(metric.key, date);
  const seeded = seededMatch(inventory.seeded.Observation, identifier, inventory.patient.id!);
  if (seeded) return { resourceType: "Observation", identifier, label: `${metric.display} ${date}`, existing: seeded };

  const fallbacks = inventory.observations.filter(
    observation => !observation.identifier?.some(item => item.system === SYNTHETIC_IDENTIFIER_SYSTEM) && hasCode(observation, metric) && resourceDate(observation) === date,
  );
  if (fallbacks.length > 1) throw new Error(`Multiple existing ${metric.display} observations were found on ${date}. No data was changed.`);
  return { resourceType: "Observation", identifier, label: `${metric.display} ${date}`, existing: fallbacks[0] };
}

function planMedication(inventory: Inventory, seed: MedicationSeedDefinition): MedicationPlan {
  const seeded = seededMatch(inventory.seeded.MedicationRequest, seed.identifier, inventory.patient.id!);
  if (seeded) {
    return { resourceType: "MedicationRequest", identifier: seed.identifier, label: seed.medicationText, seed, existing: seeded, duplicateResources: [] };
  }

  const candidates = inventory.medicationRequests
    .filter(resource => medicationText(resource).trim().toLowerCase() === seed.medicationText.toLowerCase())
    .sort((a, b) => `${a.authoredOn ?? ""}:${a.id ?? ""}`.localeCompare(`${b.authoredOn ?? ""}:${b.id ?? ""}`));
  return {
    resourceType: "MedicationRequest",
    identifier: seed.identifier,
    label: seed.medicationText,
    seed,
    existing: candidates[0],
    duplicateResources: candidates.slice(1),
  };
}

function addPlannedAction(actions: UpgradeAction[], plan: PlannedUpsert<SeededResource>): void {
  actions.push({
    kind: plan.existing ? "update" : "create",
    resourceType: plan.resourceType,
    label: plan.label,
    identifier: plan.identifier,
    existingId: plan.existing?.id,
  });
}

function appendSyntheticNote(existing: fhir4.Annotation[] | undefined, text: string): fhir4.Annotation[] {
  const values = [...(existing ?? []).map(note => note.text), SYNTHETIC_NOTE, text].filter((value): value is string => Boolean(value));
  return Array.from(new Set(values), value => ({ text: value }));
}

async function mapWithConcurrency<T, R>(items: readonly T[], concurrency: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]!, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

export async function upgradeMadisonClassIv(client: FhirUpgradeClient, options: UpgradeOptions): Promise<MadisonUpgradeResult> {
  const logger = options.logger ?? (() => {});
  const inventory = await loadInventory(client);
  const patientId = inventory.patient.id!;
  const sleConditionId = inventory.sleCondition.id!;
  const lupusNephritisConditionId = inventory.lupusNephritisCondition.id!;

  const specimenPlan: PlannedUpsert<fhir4.Specimen> = {
    resourceType: "Specimen",
    identifier: BIOPSY_SPECIMEN_IDENTIFIER,
    label: "Renal biopsy specimen",
    existing: seededMatch(inventory.seeded.Specimen, BIOPSY_SPECIMEN_IDENTIFIER, patientId),
  };
  const pathologyPlans: PlannedUpsert<fhir4.Observation>[] = PATHOLOGY_FINDINGS.map(finding => ({
    resourceType: "Observation",
    identifier: pathologyObservationIdentifier(finding.key),
    label: finding.display,
    existing: seededMatch(inventory.seeded.Observation, pathologyObservationIdentifier(finding.key), patientId),
  }));
  const longitudinalPlans = LONGITUDINAL_METRICS.flatMap(metric => RENAL_DATES.map(date => planObservation(inventory, metric, date)));
  const reportPlan: PlannedUpsert<fhir4.DiagnosticReport> = {
    resourceType: "DiagnosticReport",
    identifier: PATHOLOGY_REPORT_IDENTIFIER,
    label: "Renal biopsy pathology report",
    existing: seededMatch(inventory.seeded.DiagnosticReport, PATHOLOGY_REPORT_IDENTIFIER, patientId),
  };
  const medicationPlans = MEDICATION_SEEDS.map(seed => planMedication(inventory, seed));
  const administrationPlans: PlannedUpsert<fhir4.MedicationAdministration>[] = METHYLPREDNISOLONE_DATES.map(date => ({
    resourceType: "MedicationAdministration",
    identifier: methylprednisoloneIdentifier(date),
    label: `Methylprednisolone 500 mg IV ${date}`,
    existing: seededMatch(inventory.seeded.MedicationAdministration, methylprednisoloneIdentifier(date), patientId),
  }));
  const activeLisinopril = inventory.medicationRequests.filter(
    request => medicationText(request).toLowerCase() === "lisinopril" && request.status === "active",
  );

  const actions: UpgradeAction[] = [];
  addPlannedAction(actions, specimenPlan);
  pathologyPlans.forEach(plan => addPlannedAction(actions, plan));
  longitudinalPlans.forEach(plan => addPlannedAction(actions, plan));
  addPlannedAction(actions, reportPlan);
  actions.push({ kind: "update", resourceType: "Condition", label: "Confirm M32.14 and attach Class IV pathology", existingId: lupusNephritisConditionId });
  medicationPlans.forEach(plan => {
    addPlannedAction(actions, plan);
    for (const duplicate of plan.duplicateResources) {
      actions.push({ kind: "reconcile", resourceType: "MedicationRequest", label: `Retire duplicate ${plan.label} order`, existingId: duplicate.id });
    }
  });
  administrationPlans.forEach(plan => addPlannedAction(actions, plan));
  for (const request of activeLisinopril) {
    actions.push({ kind: "reconcile", resourceType: "MedicationRequest", label: "Move lisinopril to medication history", existingId: request.id });
  }

  logger(`Madison Grace Class IV upgrade ${options.dryRun ? "dry run" : "write plan"}`);
  logger(`Patient: ${MADISON_GRACE_NAME} (${patientId})`);
  logger(`Patient count before: ${inventory.patientCount}`);
  logger(`Preserving SLE Condition: ${sleConditionId}`);
  logger(`Updating lupus-nephritis Condition in place: ${lupusNephritisConditionId}`);
  const actionCounts = actions.reduce<Record<string, number>>((counts, action) => {
    const key = `${action.kind} ${action.resourceType}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  for (const [label, count] of Object.entries(actionCounts).sort()) logger(`  ${label}: ${count}`);
  if (options.dryRun) {
    logger("Dry run complete. No FHIR resources were written.");
    return {
      dryRun: true,
      patientId,
      patientCountBefore: inventory.patientCount,
      patientCountAfter: inventory.patientCount,
      lupusNephritisConditionId,
      sleConditionId,
      actions,
      writes: 0,
      skippedAsCurrent: 0,
      created: 0,
      updated: 0,
    };
  }

  let writes = 0;
  let created = 0;
  let updated = 0;
  let skippedAsCurrent = 0;

  async function upsert<T extends SeededResource>(plan: PlannedUpsert<T>, desired: T): Promise<T> {
    if (plan.existing?.id) {
      if (resourcesEquivalent(plan.existing, desired)) {
        skippedAsCurrent++;
        return plan.existing;
      }
      writes++;
      updated++;
      return client.update(plan.resourceType, plan.existing.id, desired, plan.existing.meta?.versionId) as Promise<T>;
    }
    writes++;
    created++;
    return client.create(plan.resourceType, desired) as Promise<T>;
  }

  const specimen = await upsert(specimenPlan, buildBiopsySpecimen(patientId, specimenPlan.existing));
  if (!specimen.id) throw new Error("The FHIR server did not return an ID for the biopsy Specimen.");
  const specimenReference = `Specimen/${specimen.id}`;

  const pathologyObservations = await mapWithConcurrency(pathologyPlans, 5, async (plan, index) =>
    upsert(plan, buildPathologyObservation(PATHOLOGY_FINDINGS[index]!, patientId, specimenReference, plan.existing)),
  );
  const pathologyReferences = pathologyObservations.map((observation, index) => {
    if (!observation.id) throw new Error(`The FHIR server did not return an ID for ${PATHOLOGY_FINDINGS[index]!.display}.`);
    return { reference: `Observation/${observation.id}`, display: PATHOLOGY_FINDINGS[index]!.display };
  });

  const longitudinalDefinitions = LONGITUDINAL_METRICS.flatMap(metric =>
    RENAL_DATES.map((date, index) => ({ metric, date, value: metric.values[index]! })),
  );
  await mapWithConcurrency(longitudinalPlans, 6, async (plan, index) => {
    const definition = longitudinalDefinitions[index]!;
    return upsert(plan, buildLongitudinalObservation(definition.metric, definition.date, definition.value, patientId, plan.existing));
  });

  const report = await upsert(reportPlan, buildPathologyReport(patientId, specimenReference, pathologyReferences, reportPlan.existing));
  if (!report.id) throw new Error("The FHIR server did not return an ID for the renal biopsy DiagnosticReport.");

  const desiredCondition = buildConfirmedClassIvCondition(inventory.lupusNephritisCondition, `DiagnosticReport/${report.id}`);
  if (resourcesEquivalent(inventory.lupusNephritisCondition, desiredCondition)) {
    skippedAsCurrent++;
  } else {
    writes++;
    updated++;
    await client.update("Condition", lupusNephritisConditionId, desiredCondition, inventory.lupusNephritisCondition.meta?.versionId);
  }

  await mapWithConcurrency(medicationPlans, 4, async plan => {
    const desired = buildMedicationRequest(plan.seed, patientId, sleConditionId, lupusNephritisConditionId, plan.existing);
    return upsert(plan, desired);
  });

  for (const plan of medicationPlans) {
    for (const duplicate of plan.duplicateResources) {
      if (!duplicate.id || duplicate.status === "entered-in-error") {
        skippedAsCurrent++;
        continue;
      }
      const desired: fhir4.MedicationRequest = {
        ...duplicate,
        status: "entered-in-error",
        statusReason: { text: "Duplicate synthetic order reconciled during the Madison Class IV upgrade." },
        note: appendSyntheticNote(duplicate.note, "Superseded duplicate synthetic medication order."),
      };
      writes++;
      updated++;
      await client.update("MedicationRequest", duplicate.id, desired, duplicate.meta?.versionId);
    }
  }

  for (const request of activeLisinopril) {
    if (!request.id) continue;
    const desired: fhir4.MedicationRequest = {
      ...request,
      status: "stopped",
      statusReason: { text: "Moved to history when the synthetic maintenance regimen was reconciled to losartan." },
      note: appendSyntheticNote(request.note, "Historical therapy; no longer part of the current synthetic regimen."),
    };
    writes++;
    updated++;
    await client.update("MedicationRequest", request.id, desired, request.meta?.versionId);
  }

  await mapWithConcurrency(administrationPlans, 3, async (plan, index) =>
    upsert(plan, buildMethylprednisoloneAdministration(METHYLPREDNISOLONE_DATES[index]!, patientId, lupusNephritisConditionId, plan.existing)),
  );

  const patientsAfter = await client.search<fhir4.Patient>("Patient", "_count=100");
  if (patientsAfter.length !== inventory.patientCount) {
    throw new Error(`Patient count changed from ${inventory.patientCount} to ${patientsAfter.length}; investigate immediately.`);
  }

  logger(`Applied ${writes} writes (${created} creates, ${updated} updates); ${skippedAsCurrent} resources were already current.`);
  logger(`Patient count after: ${patientsAfter.length}`);
  return {
    dryRun: false,
    patientId,
    patientCountBefore: inventory.patientCount,
    patientCountAfter: patientsAfter.length,
    lupusNephritisConditionId,
    sleConditionId,
    actions,
    writes,
    skippedAsCurrent,
    created,
    updated,
  };
}
