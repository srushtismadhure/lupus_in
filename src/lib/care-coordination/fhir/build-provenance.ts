import { CARE_COORDINATION_SYSTEMS, CARE_COORDINATION_TERMINOLOGY_VERSION } from "../../terminology/care-coordination-codes.js";
import type { ReferralReviewInput } from "../types.js";
import { stableUuid } from "./helpers.js";

export function buildProvenance(input: ReferralReviewInput, targetReferences: string[]): fhir4.Provenance {
  return {
    resourceType: "Provenance",
    id: stableUuid(input.patientId, input.pathwayType, "provenance"),
    target: targetReferences.map(reference => ({ reference })),
    recorded: input.authoredOn,
    activity: {
      coding: [
        {
          system: CARE_COORDINATION_SYSTEMS.pathway,
          code: input.approved ? "referral-approved" : "referral-previewed",
          display: input.approved ? "Care coordination referral approved" : "Care coordination referral previewed",
          version: CARE_COORDINATION_TERMINOLOGY_VERSION,
        },
      ],
      text: input.approved ? "Referral creation after explicit clinician confirmation" : "Draft referral preview",
    },
    agent: [
      { type: { text: "Authorizing clinician" }, who: input.clinician },
      { type: { text: "Authoring software" }, who: { display: "LoopedIn Care Coordination" } },
    ],
    entity: [
      {
        role: "source",
        what: { display: `Deterministic rule ${input.sourceRuleId} v${input.ruleVersion}` },
      },
    ],
  };
}

