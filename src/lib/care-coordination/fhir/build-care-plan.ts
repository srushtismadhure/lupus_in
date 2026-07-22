import { CARE_COORDINATION_SYSTEMS, CARE_COORDINATION_TERMINOLOGY_VERSION } from "../../terminology/care-coordination-codes.js";
import type { ReferralReviewInput } from "../types.js";
import { workflowIdentifier } from "./helpers.js";

function referenceKey(reference: fhir4.Reference): string {
  return reference.reference ?? reference.display ?? "reference";
}

export function buildCarePlan(
  input: ReferralReviewInput,
  serviceRequestReference: string,
  taskReference: string,
  careTeamReference: string,
): fhir4.CarePlan {
  const existing = input.existingCarePlan;
  const activities = [
    ...(existing?.activity ?? []),
    { reference: { reference: serviceRequestReference, display: "Care coordination referral" } },
    { reference: { reference: taskReference, display: "Care coordination task" } },
  ];
  const uniqueActivities = [...new Map(activities.map(activity => [referenceKey(activity.reference ?? {}), activity])).values()];
  const careTeams = [...(existing?.careTeam ?? []), { reference: careTeamReference, display: "Renal care coordination team" }];

  return {
    ...(existing ?? {}),
    resourceType: "CarePlan",
    identifier: existing?.identifier?.length
      ? existing.identifier
      : [workflowIdentifier(input.patientId, input.pathwayType, "care-plan")],
    status: input.approved ? "active" : (existing?.status ?? "draft"),
    intent: existing?.intent ?? "plan",
    title: existing?.title ?? "Renal care coordination plan",
    category: [
      ...(
        existing?.category ?? []
      ),
      {
        coding: [
          {
            system: CARE_COORDINATION_SYSTEMS.pathway,
            code: "renal-care-coordination",
            display: "Renal care coordination",
            version: CARE_COORDINATION_TERMINOLOGY_VERSION,
          },
        ],
        text: "Renal care coordination",
      },
    ],
    subject: { reference: `Patient/${input.patientId}` },
    created: existing?.created ?? input.authoredOn,
    author: input.clinician,
    careTeam: [...new Map(careTeams.map(item => [referenceKey(item), item])).values()],
    addresses: [...new Map(input.reasonReferences.map(item => [referenceKey(item), item])).values()],
    activity: uniqueActivities,
    note: [...(existing?.note ?? []), { text: "Care coordination activity added after clinician review." }],
  };
}

