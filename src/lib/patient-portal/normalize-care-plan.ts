import { CARE_PATHWAY_PATIENT_STATUS } from "./explanations/status-language.js";
import type { CareCoordinationPlan } from "../care-coordination/types.js";
import type { PatientCarePathway } from "./types.js";

function purposeFor(title: string): string {
  const text = title.toLowerCase();
  if (text.includes("nutrition")) return "Connect you with nutrition support that is reviewed by your care team.";
  if (text.includes("transplant")) return "Coordinate a kidney transplant evaluation when your care team has shared this plan with you.";
  if (text.includes("dialysis")) return "Coordinate education and planning documented by your kidney care team.";
  if (text.includes("nurse")) return "Make sure renal monitoring, education, and outreach steps are completed.";
  return "Coordinate a referral or follow-up step in your care plan.";
}

export function normalizeCarePlan(plan: CareCoordinationPlan): PatientCarePathway[] {
  return plan.pathways
    .filter(pathway => !pathway.requiresClinicianApproval || Boolean(pathway.serviceRequestReference))
    .map(pathway => ({
      id: pathway.id,
      title: pathway.title,
      purpose: purposeFor(pathway.title),
      status: pathway.status,
      statusLabel: CARE_PATHWAY_PATIENT_STATUS[pathway.status] ?? "Care-team update available",
      nextStep: pathway.nextAction,
      responsibleParty: pathway.owner,
      patientAction: pathway.status === "scheduled" ? "Review the appointment details and preparation instructions." : undefined,
      dueDate: pathway.dueDate,
      appointment: pathway.appointments[0]?.start,
      destination: pathway.destination,
      milestones: pathway.checklist.map(item => ({ label: item.label, completed: item.state === "completed" })),
      barriers: pathway.missingRequirements,
    }));
}

