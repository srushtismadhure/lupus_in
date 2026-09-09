import type {
  PatientAppointment,
  PatientCarePathway,
  PatientDashboardSummary,
  PatientFriendlyLabResult,
  PatientMedication,
  PatientMessageSummary,
  PatientNextStep,
} from "./types.js";

function formattedLab(lab: PatientFriendlyLabResult | undefined): string | undefined {
  if (!lab || lab.value === null) return undefined;
  return `${lab.value}${lab.unit ? ` ${lab.unit}` : ""}`;
}

export function buildDashboardSummary(input: {
  labs: PatientFriendlyLabResult[];
  carePlan: PatientCarePathway[];
  appointments: PatientAppointment[];
  medications: PatientMedication[];
  messages: PatientMessageSummary[];
  coordinator: string;
  observations: fhir4.Observation[];
  conditions: fhir4.Condition[];
  encounters: fhir4.Encounter[];
  tasks: fhir4.Task[];
  serviceRequests: fhir4.ServiceRequest[];
  now?: Date;
}): PatientDashboardSummary {
  const now = input.now ?? new Date();
  const latestObservation = (code: string): fhir4.Observation | undefined => input.observations.filter(item => item.code?.coding?.some(coding => coding.code === code)).sort((a, b) => (b.effectiveDateTime ?? "").localeCompare(a.effectiveDateTime ?? ""))[0];
  const value = (observation?: fhir4.Observation): string | undefined => observation?.valueQuantity?.value !== undefined ? `${observation.valueQuantity.value}${observation.valueQuantity.unit ? ` ${observation.valueQuantity.unit}` : ""}` : observation?.valueString ?? observation?.valueCodeableConcept?.text;
  const spO2 = latestObservation("59408-5");
  const respiratoryRate = latestObservation("9279-1");
  const fev1Fvc = latestObservation("19926-5");
  const fev1Percent = latestObservation("19868-9");
  const upcoming = input.appointments.filter(appointment => !appointment.past && appointment.status !== "cancelled");
  const nextAppointment = upcoming[0];
  const activePathways = input.carePlan.filter(pathway => !["completed", "closed", "declined"].includes(pathway.status));
  const monitoringItems = input.medications.flatMap(medication => medication.monitoring).filter(item => item.status !== "current").length;
  const nextSteps: PatientNextStep[] = activePathways.slice(0, 3).map(pathway => ({
    id: `pathway-${pathway.id}`,
    title: pathway.nextStep,
    whyItMatters: pathway.purpose,
    responsibleParty: pathway.responsibleParty,
    dueDate: pathway.dueDate,
    patientAction: pathway.patientAction,
    status: pathway.statusLabel,
  }));
  if (nextSteps.length < 3) {
    for (const lab of input.labs.filter(item => item.reviewStatus === "awaiting-review").slice(0, 3 - nextSteps.length)) {
      nextSteps.push({
        id: `lab-${lab.id}`,
        title: `Review ${lab.plainLanguageName}`,
        whyItMatters: lab.whatItChecks,
        responsibleParty: "Care team",
        status: lab.reviewStatusLabel,
      });
    }
  }
  const copdCondition = input.conditions.some(condition => /copd|chronic obstructive pulmonary disease/i.test(`${condition.code?.text ?? ""} ${condition.code?.coding?.map(coding => `${coding.display ?? ""} ${coding.code ?? ""}`).join(" ") ?? ""}`));
  const exacerbations = input.encounters.filter(encounter => /exacerbation|emergency|hospital/i.test(`${encounter.reasonCode?.map(reason => reason.text).join(" ") ?? ""} ${encounter.type?.map(type => type.text).join(" ") ?? ""}`));
  const homeHealth = input.encounters.some(encounter => encounter.class?.code === "HH") ? "Active" : "Not available";
  const pulmonaryRehab = input.serviceRequests.some(request => /pulmonary rehab/i.test(`${request.code?.text ?? ""} ${request.reasonCode?.map(reason => reason.text).join(" ") ?? ""}`)) ? "Referral listed" : "Not available";

  return {
    today: nextSteps.slice(0, 3),
    copdStatus: {
      diagnosis: copdCondition ? "COPD diagnosis documented" : "No COPD diagnosis found in available record.",
      fev1Fvc: value(fev1Fvc),
      fev1PercentPredicted: value(fev1Percent),
      airflowLimitation: value(fev1Percent) ? "Review with your care team" : "Not available",
    },
    respiratoryStatus: {
      latestSpO2: value(spO2),
      respiratoryRate: value(respiratoryRate),
      trend: "Not available",
    },
    exacerbations: { summary: exacerbations.length ? `${exacerbations.length} documented in available record` : "Not available", recentCount: exacerbations.length, hospitalizations: input.encounters.filter(encounter => encounter.class?.code === "IMP").length },
    currentCare: { homeHealth, pulmonaryRehab, openTasks: input.tasks.filter(task => !["completed", "cancelled"].includes(task.status)).length, nextAppointment },
    nextAppointment,
    carePlan: {
      activeSteps: activePathways.length,
      nextAction: activePathways[0]?.nextStep ?? "No action is currently listed in your care plan.",
      coordinator: input.coordinator,
    },
    medications: {
      activeCount: input.medications.filter(medication => medication.status === "active").length,
      monitoringItems,
    },
    messages: {
      unreadCount: 0,
      latestSubject: input.messages[0]?.subject,
    },
  };
}

