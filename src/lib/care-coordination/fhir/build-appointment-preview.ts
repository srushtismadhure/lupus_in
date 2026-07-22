import { CARE_COORDINATION_SERVICE_CODES } from "../../terminology/care-coordination-codes.js";
import type { ReferralReviewInput } from "../types.js";

export function buildAppointmentPreview(
  input: ReferralReviewInput,
  serviceRequestReference: string,
  start?: string,
  end?: string,
): fhir4.Appointment {
  const service = CARE_COORDINATION_SERVICE_CODES[input.pathwayType];
  return {
    resourceType: "Appointment",
    status: "proposed",
    serviceType: [{ text: service.display }],
    description: `${service.display} appointment preview`,
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
    basedOn: [{ reference: serviceRequestReference, display: service.display }],
    participant: [
      { actor: { reference: `Patient/${input.patientId}` }, status: "needs-action" },
      ...(input.destination
        ? [
            {
              actor: input.destination.reference
                ? { reference: input.destination.reference, display: input.destination.display }
                : { display: input.destination.display },
              status: "needs-action" as const,
            },
          ]
        : []),
    ],
  };
}

