import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PatientHeader } from "@/components/patients/PatientHeader";
import { MetricCard } from "@/components/clinical/MetricCard";
import { KidneyTrendChart } from "@/components/clinical/KidneyTrendChart";
import { ImmunologicActivityCard } from "@/components/clinical/ImmunologicActivityCard";
import { ConditionsCard } from "@/components/clinical/ConditionsCard";
import { MedicationsCard } from "@/components/clinical/MedicationsCard";
import { TasksCard } from "@/components/clinical/TasksCard";
import { CreateTaskDialog } from "@/components/clinical/CreateTaskDialog";
import { NotConfiguredCard } from "@/components/clinical/NotConfiguredCard";
import { FhirTransparencyPanel } from "@/components/clinical/FhirTransparencyPanel";
import {
  getPatient,
  getPatientConditions,
  getPatientMedicationRequests,
  getPatientObservations,
  getPatientTasks,
} from "@/lib/fhir";
import {
  computeTrendDirection,
  filterObservationsByLoinc,
  getLatestBloodPressure,
  getLatestObservation,
  getPreviousObservation,
  getObservationQuantityValue,
  LOINC_CODES,
} from "@/lib/fhir-observations";

interface SectionState<T> {
  data: T;
  failed: boolean;
}

interface DashboardData {
  patient: fhir4.Patient;
  conditions: SectionState<fhir4.Condition[]>;
  observations: SectionState<fhir4.Observation[]>;
  medicationRequests: SectionState<fhir4.MedicationRequest[]>;
  tasks: SectionState<fhir4.Task[]>;
}

function fromSettled<T>(result: PromiseSettledResult<T[]>): SectionState<T[]> {
  return result.status === "fulfilled" ? { data: result.value, failed: false } : { data: [], failed: true };
}

export function PatientDashboardPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);

    try {
      const patient = await getPatient(patientId);
      const [conditions, observations, medicationRequests, tasks] = await Promise.allSettled([
        getPatientConditions(patientId),
        getPatientObservations(patientId),
        getPatientMedicationRequests(patientId),
        getPatientTasks(patientId),
      ]);

      setData({
        patient,
        conditions: fromSettled(conditions),
        observations: fromSettled(observations),
        medicationRequests: fromSettled(medicationRequests),
        tasks: fromSettled(tasks),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load patient");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  if (loading) {
    return (
      <AppShell title="Patient dashboard">
        <p className="text-sm text-muted-foreground">Loading patient...</p>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell title="Patient dashboard">
        <Alert variant="destructive">
          <AlertDescription>{error ?? "Unable to load patient."}</AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  const { patient, conditions, observations, medicationRequests, tasks } = data;

  const upcrObservations = filterObservationsByLoinc(observations.data, LOINC_CODES.upcr);
  const egfrObservations = filterObservationsByLoinc(observations.data, LOINC_CODES.egfr);
  const creatinineObservations = filterObservationsByLoinc(observations.data, LOINC_CODES.serumCreatinine);

  const upcrLatest = getLatestObservation(upcrObservations);
  const upcrPrevious = getPreviousObservation(upcrObservations);
  const egfrLatest = getLatestObservation(egfrObservations);
  const egfrPrevious = getPreviousObservation(egfrObservations);
  const creatinineLatest = getLatestObservation(creatinineObservations);
  const creatininePrevious = getPreviousObservation(creatinineObservations);
  const bloodPressure = getLatestBloodPressure(observations.data);

  const upcrLatestValue = upcrLatest ? getObservationQuantityValue(upcrLatest) : undefined;
  const upcrPreviousValue = upcrPrevious ? getObservationQuantityValue(upcrPrevious) : undefined;
  const egfrLatestValue = egfrLatest ? getObservationQuantityValue(egfrLatest) : undefined;
  const egfrPreviousValue = egfrPrevious ? getObservationQuantityValue(egfrPrevious) : undefined;
  const creatinineLatestValue = creatinineLatest ? getObservationQuantityValue(creatinineLatest) : undefined;
  const creatininePreviousValue = creatininePrevious ? getObservationQuantityValue(creatininePrevious) : undefined;

  return (
    <AppShell title="Patient dashboard" subtitle="Lupus nephritis clinical overview">
      <PatientHeader
        patient={patient}
        conditions={conditions.data}
        onCreateTask={() => setCreateTaskOpen(true)}
        onPatientUpdated={() => setReloadKey(k => k + 1)}
      />

      {(conditions.failed || observations.failed || medicationRequests.failed || tasks.failed) && (
        <Alert variant="warning" className="mb-4">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Some clinical data could not be loaded.</span>
            <Button size="sm" variant="outline" onClick={() => setReloadKey(k => k + 1)}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="UPCR"
          accent="purple"
          value={upcrLatestValue ? `${upcrLatestValue.value}` : undefined}
          unit={upcrLatestValue?.unit}
          observation={upcrLatest}
          previousValue={upcrPreviousValue ? `${upcrPreviousValue.value}${upcrPreviousValue.unit ? ` ${upcrPreviousValue.unit}` : ""}` : undefined}
          trend={computeTrendDirection(upcrLatestValue, upcrPreviousValue)}
        />
        <MetricCard
          title="eGFR"
          accent="blue"
          value={egfrLatestValue ? `${egfrLatestValue.value}` : undefined}
          unit={egfrLatestValue?.unit}
          observation={egfrLatest}
          previousValue={egfrPreviousValue ? `${egfrPreviousValue.value}${egfrPreviousValue.unit ? ` ${egfrPreviousValue.unit}` : ""}` : undefined}
          trend={computeTrendDirection(egfrLatestValue, egfrPreviousValue)}
        />
        <MetricCard
          title="Serum creatinine"
          accent="purple"
          value={creatinineLatestValue ? `${creatinineLatestValue.value}` : undefined}
          unit={creatinineLatestValue?.unit}
          observation={creatinineLatest}
          previousValue={
            creatininePreviousValue ? `${creatininePreviousValue.value}${creatininePreviousValue.unit ? ` ${creatininePreviousValue.unit}` : ""}` : undefined
          }
          trend={computeTrendDirection(creatinineLatestValue, creatininePreviousValue)}
        />
        <MetricCard
          title="Blood pressure"
          accent="blue"
          value={
            bloodPressure?.systolic && bloodPressure?.diastolic
              ? `${bloodPressure.systolic.value}/${bloodPressure.diastolic.value}`
              : undefined
          }
          unit={bloodPressure?.systolic?.unit}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <KidneyTrendChart observations={observations.data} />
        <ImmunologicActivityCard observations={observations.data} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ConditionsCard conditions={conditions.data} />
        <MedicationsCard medicationRequests={medicationRequests.data} />
      </div>

      <div className="mb-6">
        <TasksCard tasks={tasks.data} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <NotConfiguredCard title="Clinical Trial Matching" message="ClinicalTrials.gov integration is not configured." />
        <NotConfiguredCard title="Kidney Transplant Referral Readiness" message="Referral-readiness criteria are not configured." />
      </div>

      <FhirTransparencyPanel
        patient={patient}
        conditions={conditions.data}
        observations={observations.data}
        medicationRequests={medicationRequests.data}
        tasks={tasks.data}
      />

      {patient.id && (
        <CreateTaskDialog
          open={createTaskOpen}
          onOpenChange={setCreateTaskOpen}
          patientId={patient.id}
          onCreated={() => setReloadKey(k => k + 1)}
        />
      )}
    </AppShell>
  );
}
