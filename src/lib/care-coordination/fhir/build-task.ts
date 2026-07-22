import {
  CARE_COORDINATION_SERVICE_CODES,
  CARE_COORDINATION_SYSTEMS,
  CARE_COORDINATION_TERMINOLOGY_VERSION,
} from "../../terminology/care-coordination-codes.js";
import type { ReferralReviewInput } from "../types.js";
import { workflowIdentifier } from "./helpers.js";

export function buildCoordinationTask(input: ReferralReviewInput, focusReference: string): fhir4.Task {
  const service = CARE_COORDINATION_SERVICE_CODES[input.pathwayType];
  return {
    resourceType: "Task",
    identifier: [workflowIdentifier(input.patientId, input.pathwayType, "coordination-task")],
    status: input.approved ? "requested" : "draft",
    intent: "order",
    priority: input.pathwayType === "renal-nurse-follow-up" ? "urgent" : "routine",
    code: {
      coding: [
        {
          system: CARE_COORDINATION_SYSTEMS.pathway,
          code: input.pathwayType,
          display: service.display,
          version: CARE_COORDINATION_TERMINOLOGY_VERSION,
        },
      ],
      text: `Coordinate ${service.display}`,
    },
    description: `Coordinate ${service.display} referral and follow-up`,
    focus: { reference: focusReference, display: service.display },
    for: { reference: `Patient/${input.patientId}` },
    authoredOn: input.authoredOn,
    requester: input.clinician,
    ...(input.coordinator ? { owner: input.coordinator } : {}),
    ...(input.dueDate ? { restriction: { period: { end: input.dueDate } } } : {}),
    note: [{ text: input.approved ? "Created after explicit clinician confirmation." : "Draft coordination task; not yet assigned for execution." }],
  };
}

