import type { CareCoordinationReferralPreview, ReferralReviewInput } from "../types.js";
import { buildCarePlan } from "./build-care-plan.js";
import { buildCareTeam } from "./build-care-team.js";
import { buildProvenance } from "./build-provenance.js";
import { buildServiceRequest } from "./build-service-request.js";
import { buildCoordinationTask } from "./build-task.js";
import { identifierSearch, transactionFullUrl } from "./helpers.js";

function entryRequest(resource: fhir4.Resource, resourceType: string, ifNoneExist?: string): fhir4.BundleEntryRequest {
  if (resource.id) return { method: "PUT", url: `${resourceType}/${resource.id}` };
  return { method: "POST", url: resourceType, ...(ifNoneExist ? { ifNoneExist } : {}) };
}

export function buildCareCoordinationTransaction(input: ReferralReviewInput): CareCoordinationReferralPreview {
  const serviceRequestReference = transactionFullUrl(input.patientId, input.pathwayType, "service-request");
  const taskReference = transactionFullUrl(input.patientId, input.pathwayType, "task");
  const carePlanReference = input.existingCarePlan?.id
    ? `CarePlan/${input.existingCarePlan.id}`
    : transactionFullUrl(input.patientId, input.pathwayType, "care-plan");
  const careTeamReference = input.existingCareTeam?.id
    ? `CareTeam/${input.existingCareTeam.id}`
    : transactionFullUrl(input.patientId, input.pathwayType, "care-team");

  const serviceRequest = buildServiceRequest(input);
  const task = buildCoordinationTask(input, serviceRequestReference);
  const careTeam = buildCareTeam(input);
  const carePlan = buildCarePlan(input, serviceRequestReference, taskReference, careTeamReference);
  const provenance = buildProvenance(input, [serviceRequestReference, taskReference, carePlanReference]);

  const transaction: fhir4.Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    timestamp: input.authoredOn,
    entry: [
      {
        fullUrl: serviceRequestReference,
        resource: serviceRequest,
        request: entryRequest(serviceRequest, "ServiceRequest", identifierSearch(serviceRequest.identifier![0]!)),
      },
      {
        fullUrl: taskReference,
        resource: task,
        request: entryRequest(task, "Task", identifierSearch(task.identifier![0]!)),
      },
      {
        fullUrl: careTeamReference,
        resource: careTeam,
        request: entryRequest(
          careTeam,
          "CareTeam",
          careTeam.id || !careTeam.identifier?.[0] ? undefined : identifierSearch(careTeam.identifier[0]),
        ),
      },
      {
        fullUrl: carePlanReference,
        resource: carePlan,
        request: entryRequest(
          carePlan,
          "CarePlan",
          carePlan.id || !carePlan.identifier?.[0] ? undefined : identifierSearch(carePlan.identifier[0]),
        ),
      },
      {
        fullUrl: `urn:uuid:${provenance.id}`,
        resource: provenance,
        request: entryRequest(provenance, "Provenance"),
      },
    ],
  };

  return { serviceRequest, task, carePlan, careTeam, provenance, transaction };
}

