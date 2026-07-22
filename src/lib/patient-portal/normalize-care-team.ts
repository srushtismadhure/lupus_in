import type { CareCoordinationPlan } from "../care-coordination/types.js";
import type { PatientCareTeamMember } from "./types.js";

function helpText(role: string): string {
  const text = role.toLowerCase();
  if (text.includes("nephrolog")) return "Helps manage your kidney health and treatment plan.";
  if (text.includes("nurse")) return "Helps with follow-up, education, symptoms, and laboratory scheduling.";
  if (text.includes("coordinator")) return "Helps organize referrals, appointments, and next steps.";
  if (text.includes("diet")) return "Helps turn your care plan into nutrition guidance that fits your needs.";
  if (text.includes("social")) return "Helps address practical, financial, and support needs documented in your plan.";
  if (text.includes("pharmac")) return "Helps review medicines and monitoring needs.";
  return "Participates in your documented care plan.";
}

export function normalizeCareTeamForPortal(plan: CareCoordinationPlan): PatientCareTeamMember[] {
  return plan.careTeam.map(member => ({
    id: member.id,
    name: member.name,
    role: member.role,
    organization: member.organization,
    howTheyHelp: helpText(member.role),
    currentInvolvement: member.responsibilities,
    canMessage: true,
  }));
}

