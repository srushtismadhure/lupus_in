import { CARE_COORDINATION_SYSTEMS, CARE_COORDINATION_TERMINOLOGY_VERSION } from "../../terminology/care-coordination-codes.js";
import type { ReferralReviewInput } from "../types.js";
import { workflowIdentifier } from "./helpers.js";

function participant(reference: fhir4.Reference, code: string, display: string): fhir4.CareTeamParticipant {
  return {
    role: [
      {
        coding: [
          {
            system: CARE_COORDINATION_SYSTEMS.role,
            code,
            display,
            version: CARE_COORDINATION_TERMINOLOGY_VERSION,
          },
        ],
        text: display,
      },
    ],
    member: reference,
  };
}

function memberKey(item: fhir4.CareTeamParticipant): string {
  return item.member?.reference ?? `${item.role?.[0]?.text ?? "role"}:${item.member?.display ?? "member"}`;
}

export function buildCareTeam(input: ReferralReviewInput): fhir4.CareTeam {
  const existing = input.existingCareTeam;
  const participants = [...(existing?.participant ?? []), participant(input.clinician, "treating-clinician", "Primary treating clinician")];
  if (input.coordinator) participants.push(participant(input.coordinator, "care-coordinator", "Care coordinator"));
  const unique = [...new Map(participants.map(item => [memberKey(item), item])).values()];

  return {
    ...(existing ?? {}),
    resourceType: "CareTeam",
    identifier: existing?.identifier?.length
      ? existing.identifier
      : [workflowIdentifier(input.patientId, input.pathwayType, "care-team")],
    status: input.approved ? "active" : (existing?.status ?? "proposed"),
    name: existing?.name ?? "Renal care coordination team",
    subject: { reference: `Patient/${input.patientId}` },
    participant: unique,
  };
}

