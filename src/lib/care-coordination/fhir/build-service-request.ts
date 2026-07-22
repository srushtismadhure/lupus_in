import {
  CARE_COORDINATION_SERVICE_CODES,
  CARE_COORDINATION_SYSTEMS,
  CARE_COORDINATION_TERMINOLOGY_VERSION,
  TERMINOLOGY_REVIEW_NOTE,
} from "../../terminology/care-coordination-codes.js";
import type { ReferralReviewInput } from "../types.js";
import { workflowIdentifier } from "./helpers.js";

export function buildServiceRequest(input: ReferralReviewInput): fhir4.ServiceRequest {
  const service = CARE_COORDINATION_SERVICE_CODES[input.pathwayType];
  return {
    resourceType: "ServiceRequest",
    identifier: [workflowIdentifier(input.patientId, input.pathwayType, "service-request")],
    status: input.approved ? "active" : "draft",
    intent: input.approved ? "order" : "proposal",
    priority: input.pathwayType === "renal-nurse-follow-up" ? "urgent" : "routine",
    code: {
      coding: [
        {
          system: CARE_COORDINATION_SYSTEMS.service,
          code: service.code,
          display: service.display,
          version: CARE_COORDINATION_TERMINOLOGY_VERSION,
        },
      ],
      text: service.display,
    },
    subject: { reference: `Patient/${input.patientId}` },
    authoredOn: input.authoredOn,
    ...(input.approved ? { requester: input.clinician } : {}),
    ...(input.destination
      ? {
          performer: [
            input.destination.reference
              ? { reference: input.destination.reference, display: input.destination.display }
              : { display: input.destination.display },
          ],
        }
      : {}),
    reasonReference: input.reasonReferences,
    supportingInfo: input.supportingInfo,
    note: [
      {
        text: `${input.reason} Suggested by deterministic rule ${input.sourceRuleId} v${input.ruleVersion}. ${TERMINOLOGY_REVIEW_NOTE}`,
      },
    ],
  };
}

