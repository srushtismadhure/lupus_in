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
  lupusAreasMonitored: number;
  now?: Date;
}): PatientDashboardSummary {
  const now = input.now ?? new Date();
  const egfr = input.labs.find(lab => lab.plainLanguageName === "Estimated kidney filtering rate");
  const creatinine = input.labs.find(lab => lab.plainLanguageName === "Creatinine");
  const upcr = input.labs.find(lab => lab.plainLanguageName === "Urine protein-to-creatinine ratio");
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
  const latestDate = [egfr?.date, creatinine?.date, upcr?.date].filter((value): value is string => Boolean(value)).sort().pop();
  const completeKidneySet = Boolean(egfr && creatinine && upcr);

  return {
    today: nextSteps.slice(0, 3),
    kidneyHealth: {
      latestDate,
      egfr: formattedLab(egfr),
      creatinine: formattedLab(creatinine),
      urineProtein: formattedLab(upcr),
      status: completeKidneySet ? "Recent kidney results are available for review." : "Some kidney monitoring information is not available.",
    },
    lupusOverview: {
      areasMonitored: input.lupusAreasMonitored,
      followUpStatus: activePathways.length > 0 ? "Follow-up steps are listed in your care plan." : "No next step is currently listed in the available care plan.",
    },
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

