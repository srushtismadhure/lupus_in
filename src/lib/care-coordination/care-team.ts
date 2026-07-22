import { CARE_COORDINATION_SYSTEMS, CARE_TEAM_ROLE_CODES, TERMINOLOGY_REVIEW_NOTE } from "../terminology/care-coordination-codes.js";
import type { CareTeamMember, CoordinationTask } from "./types.js";

type CareTeamRoleCode = keyof typeof CARE_TEAM_ROLE_CODES;

function roleText(participant: fhir4.CareTeamParticipant): string {
  return (
    participant.role?.[0]?.text ??
    participant.role?.[0]?.coding?.[0]?.display ??
    participant.role?.[0]?.coding?.[0]?.code ??
    "Care team member"
  );
}

function normalizedRoleCode(value: string): CareTeamRoleCode {
  const text = value.toLowerCase();
  if (text.includes("nephrolog")) return "nephrologist";
  if (text.includes("diet") || text.includes("nutrition")) return "dietitian";
  if (text.includes("transplant") && text.includes("coordin")) return "transplant-coordinator";
  if (text.includes("coordin")) return "care-coordinator";
  if (text.includes("renal") && (text.includes("nurse") || text.includes("rn"))) return "renal-nurse";
  if (text.includes("social")) return "social-worker";
  if (text.includes("pharmac")) return "pharmacist";
  if (text.includes("organization") || text.includes("service")) return "organization";
  if (text.includes("clinician") || text.includes("physician") || text.includes("doctor")) return "treating-clinician";
  return "other";
}

function canonicalReference(reference: string | undefined): string | undefined {
  if (!reference) return undefined;
  const match = reference.match(/(?:^|\/)(PractitionerRole|Practitioner|Organization|CareTeam)\/([^/]+)$/);
  return match ? `${match[1]}/${match[2]}` : reference;
}

function taskOwnedBy(task: CoordinationTask, memberReference: string | undefined, memberName: string): boolean {
  if (memberReference && canonicalReference(task.ownerReference) === canonicalReference(memberReference)) return true;
  return task.ownerDisplay !== "Unassigned" && task.ownerDisplay.toLowerCase() === memberName.toLowerCase();
}

export function normalizeCareTeam(
  careTeams: fhir4.CareTeam[],
  tasks: CoordinationTask[],
  resolvedReferences: Record<string, { display: string; resourceType: string }> = {},
): CareTeamMember[] {
  const members = new Map<string, CareTeamMember>();

  for (const careTeam of careTeams.filter(team => team.status !== "entered-in-error")) {
    for (const [index, participant] of (careTeam.participant ?? []).entries()) {
      const reference = canonicalReference(participant.member?.reference);
      const rawRole = roleText(participant);
      const roleCode = normalizedRoleCode(rawRole);
      const role = CARE_TEAM_ROLE_CODES[roleCode].display;
      const name = participant.member?.display ?? (reference ? resolvedReferences[reference]?.display : undefined) ?? "Unnamed care team member";
      const key = reference ?? `${roleCode}:${name.toLowerCase()}`;
      const existing = members.get(key);
      const ownedTasks = tasks.filter(task => taskOwnedBy(task, reference, name));

      members.set(key, {
        id: existing?.id ?? `${careTeam.id ?? "care-team"}-${index}`,
        reference,
        name,
        role,
        roleCode,
        organization: participant.member?.display && reference?.startsWith("Organization/") ? participant.member.display : existing?.organization,
        responsibilities: [...new Set([...(existing?.responsibilities ?? []), ...ownedTasks.map(task => task.description)])],
        openTaskCount: ownedTasks.length,
      });
    }
  }

  return [...members.values()].sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
}

export function buildDraftCareTeam(patientId: string, participants: CareTeamMember[] = []): fhir4.CareTeam {
  return {
    resourceType: "CareTeam",
    identifier: [
      {
        system: CARE_COORDINATION_SYSTEMS.identifier,
        value: `renal-care-team-${patientId}`,
      },
    ],
    status: "proposed",
    name: "Renal care coordination team",
    subject: { reference: `Patient/${patientId}` },
    participant: participants.map(participant => ({
      role: [
        {
          coding: [
            {
              system: CARE_COORDINATION_SYSTEMS.role,
              code: participant.roleCode,
              display: participant.role,
              version: "1.0.0",
            },
          ],
          text: participant.role,
        },
      ],
      member: participant.reference ? { reference: participant.reference, display: participant.name } : { display: participant.name },
    })),
    note: [{ text: TERMINOLOGY_REVIEW_NOTE }],
  };
}

