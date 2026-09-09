import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PatientHeader } from "@/components/patients/PatientHeader";
import { PatientSubNav } from "@/components/patients/PatientSubNav";
import { MedicationManagementCard } from "@/components/medications/MedicationManagementCard";
import { MetricCard } from "@/components/clinical/MetricCard";
import { KidneyTrendChart } from "@/components/clinical/KidneyTrendChart";
import { ImmunologicActivityCard } from "@/components/clinical/ImmunologicActivityCard";
import { ConditionsCard } from "@/components/clinical/ConditionsCard";
import { MedicationsCard } from "@/components/clinical/MedicationsCard";
import { TasksCard } from "@/components/clinical/TasksCard";
import { CreateTaskDialog } from "@/components/clinical/CreateTaskDialog";
import { NotConfiguredCard } from "@/components/clinical/NotConfiguredCard";
import { FhirTransparencyPanel } from "@/components/clinical/FhirTransparencyPanel";
import { AutomaticRenalCds } from "@/components/clinical/AutomaticRenalCds";
import { RenalResponseOverview } from "@/components/clinical/RenalResponseOverview";
import {
  getPatient,
  getPatientConditions,
  getPatientDiagnosticReports,
  getPatientMedicationAdministrations,
  getPatientMedicationRequests,
  getPatientMedicationStatements,
  getPatientEncounters,
  getPatientDetectedIssues,
  getPatientDocumentReferences,
  getPatientServiceRequests,
  getPatientImmunizations,
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
import { buildRenalResponseModel } from "@/lib/renal-response";
import { CopdOverview } from "@/components/patient-overview/CopdOverview";

interface SectionState<T> {
  data: T;
  failed: boolean;
}

interface DashboardData {
  patient: fhir4.Patient;
  conditions: SectionState<fhir4.Condition[]>;
  observations: SectionState<fhir4.Observation[]>;
  medicationRequests: SectionState<fhir4.MedicationRequest[]>;
  diagnosticReports: SectionState<fhir4.DiagnosticReport[]>;
  medicationAdministrations: SectionState<fhir4.MedicationAdministration[]>;
  tasks: SectionState<fhir4.Task[]>;
  encounters: SectionState<fhir4.Encounter[]>;
  medicationStatements: SectionState<fhir4.MedicationStatement[]>;
  detectedIssues: SectionState<fhir4.DetectedIssue[]>;
  documentReferences: SectionState<fhir4.DocumentReference[]>;
  serviceRequests: SectionState<fhir4.ServiceRequest[]>;
  immunizations: SectionState<fhir4.Immunization[]>;
}

function fromSettled<T>(result: PromiseSettledResult<T[]>): SectionState<T[]> {
  return result.status === "fulfilled" ? { data: result.value, failed: false } : { data: [], failed: true };
}

export function PatientDashboardPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
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
      const [conditions, observations, medicationRequests, medicationAdministrations, diagnosticReports, tasks, encounters, medicationStatements, detectedIssues, documentReferences, serviceRequests, immunizations] = await Promise.allSettled([
        getPatientConditions(patientId),
        getPatientObservations(patientId),
        getPatientMedicationRequests(patientId),
        getPatientMedicationAdministrations(patientId),
        getPatientDiagnosticReports(patientId),
        getPatientTasks(patientId),
        getPatientEncounters(patientId),
        getPatientMedicationStatements(patientId),
        getPatientDetectedIssues(patientId),
        getPatientDocumentReferences(patientId),
        getPatientServiceRequests(patientId),
        getPatientImmunizations(patientId),
      ]);

      setData({
        patient,
        conditions: fromSettled(conditions),
        observations: fromSettled(observations),
        medicationRequests: fromSettled(medicationRequests),
        medicationAdministrations: fromSettled(medicationAdministrations),
        diagnosticReports: fromSettled(diagnosticReports),
        tasks: fromSettled(tasks),
        encounters: fromSettled(encounters),
        medicationStatements: fromSettled(medicationStatements),
        detectedIssues: fromSettled(detectedIssues),
        documentReferences: fromSettled(documentReferences),
        serviceRequests: fromSettled(serviceRequests),
        immunizations: fromSettled(immunizations),
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

  const { patient, conditions, observations, medicationRequests, medicationAdministrations, diagnosticReports, tasks, encounters, medicationStatements, detectedIssues, documentReferences, serviceRequests, immunizations } = data;
  const partialData = conditions.failed || observations.failed || medicationRequests.failed || medicationAdministrations.failed || diagnosticReports.failed || tasks.failed;

  const isCopdPatient = conditions.data.some(condition => condition.code?.coding?.some(coding => coding.code === "J44.9" || /chronic obstructive pulmonary disease|copd/i.test(coding.display ?? "")) || /chronic obstructive pulmonary disease|copd/i.test(condition.code?.text ?? ""));

  if (isCopdPatient) {
    return (
      <AppShell title="Patient overview" subtitle="COPD clinical overview and post-acute care status">
        <PatientHeader
          patient={patient}
          conditions={conditions.data}
          onCreateTask={() => setCreateTaskOpen(true)}
          onAddClinicalNote={() => patient.id && navigate(`/patients/${patient.id}/notes-coding`)}
          onPatientUpdated={() => setReloadKey(k => k + 1)}
        />
        {patient.id && <PatientSubNav patientId={patient.id} />}
        {partialData && <Alert variant="warning" className="mb-4"><AlertDescription className="flex items-center justify-between gap-3"><span>Some clinical data could not be loaded.</span><Button size="sm" variant="outline" onClick={() => setReloadKey(k => k + 1)}>Retry</Button></AlertDescription></Alert>}
        <CopdOverview patientId={patient.id ?? ""} conditions={conditions.data} observations={observations.data} medicationRequests={medicationRequests.data} tasks={tasks.data} encounters={encounters.data} medicationStatements={medicationStatements.data} detectedIssues={detectedIssues.data} documentReferences={documentReferences.data} serviceRequests={serviceRequests.data} immunizations={immunizations.data} diagnosticReports={diagnosticReports.data} />
        {patient.id && <CreateTaskDialog open={createTaskOpen} onOpenChange={setCreateTaskOpen} patientId={patient.id} onCreated={() => setReloadKey(k => k + 1)} />}
      </AppShell>
    );
  }

  const renalModel = buildRenalResponseModel({
    patient,
    conditions: conditions.data,
    diagnosticReports: diagnosticReports.data,
    observations: observations.data,
    medicationRequests: medicationRequests.data,
    medicationAdministrations: medicationAdministrations.data,
  });

  if (renalModel.mode === "renal-response") {
    return (
      <AppShell title="Patient overview" subtitle="Biopsy-confirmed lupus nephritis renal response">
        <PatientHeader
          patient={patient}
          conditions={conditions.data}
          onCreateTask={() => setCreateTaskOpen(true)}
          onAddClinicalNote={() => patient.id && navigate(`/patients/${patient.id}/notes-coding`)}
          onPatientUpdated={() => setReloadKey(k => k + 1)}
        />

        {patient.id && <PatientSubNav patientId={patient.id} />}

        {partialData && (
          <Alert variant="warning" className="mb-4">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>Some clinical data could not be loaded.</span>
              <Button size="sm" variant="outline" onClick={() => setReloadKey(k => k + 1)}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <RenalResponseOverview model={renalModel} />

        {patient.id && (
          <div className="mt-5">
            <AutomaticRenalCds patientId={patient.id} userId="PractitionerRole/demo-nephrologist" />
          </div>
        )}

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
    <AppShell title="Patient overview" subtitle="Renal surveillance clinical overview">
      <PatientHeader
        patient={patient}
        conditions={conditions.data}
        onCreateTask={() => setCreateTaskOpen(true)}
        onAddClinicalNote={() => patient.id && navigate(`/patients/${patient.id}/notes-coding`)}
        onPatientUpdated={() => setReloadKey(k => k + 1)}
      />

      {patient.id && <PatientSubNav patientId={patient.id} />}

      {partialData && (
        <Alert variant="warning" className="mb-4">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Some clinical data could not be loaded.</span>
            <Button size="sm" variant="outline" onClick={() => setReloadKey(k => k + 1)}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {patient.id && <AutomaticRenalCds patientId={patient.id} userId="PractitionerRole/demo-nephrologist" />}

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

      {patient.id && (
        <div className="mb-6">
          <MedicationManagementCard patientId={patient.id} />
        </div>
      )}

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
