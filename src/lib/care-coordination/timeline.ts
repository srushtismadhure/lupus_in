import type { CareCoordinationRawData, CoordinationEvent } from "./types.js";

function resourceTimestamp(resource: fhir4.Resource, fallback?: string): string {
  return resource.meta?.lastUpdated ?? fallback ?? "1970-01-01T00:00:00.000Z";
}

function event(
  resource: fhir4.Resource,
  timestamp: string,
  eventType: CoordinationEvent["eventType"],
  title: string,
  detail?: string,
): CoordinationEvent {
  return {
    id: `${resource.resourceType}-${resource.id ?? eventType}-${eventType}`,
    timestamp,
    eventType,
    title,
    detail,
    resourceReference: resource.id ? `${resource.resourceType}/${resource.id}` : undefined,
  };
}

export function buildCoordinationTimeline(raw: CareCoordinationRawData): CoordinationEvent[] {
  const events: CoordinationEvent[] = [];

  for (const request of raw.serviceRequests) {
    const title = request.code?.text ?? request.code?.coding?.[0]?.display ?? "Referral";
    const timestamp = resourceTimestamp(request, request.authoredOn);
    if (request.status === "draft") events.push(event(request, timestamp, "proposal-created", `${title} proposed`));
    if (request.status === "active") events.push(event(request, timestamp, "referral-approved", `${title} approved`));
    if (request.status === "completed") events.push(event(request, timestamp, "pathway-closed", `${title} completed`));
    if (request.status === "revoked") events.push(event(request, timestamp, "pathway-declined", `${title} not moving forward`));
  }

  for (const task of raw.tasks) {
    const timestamp = resourceTimestamp(task, task.authoredOn ?? task.executionPeriod?.start);
    const title = task.description ?? "Coordination task";
    if (task.status === "requested" || task.status === "ready") events.push(event(task, timestamp, "task-created", title));
    if (task.status === "in-progress") events.push(event(task, timestamp, "task-started", title));
    if (task.status === "on-hold") events.push(event(task, timestamp, "task-blocked", title, task.businessStatus?.text));
    if (task.owner) events.push({ ...event(task, timestamp, "task-assigned", title, task.owner.display), actorReference: task.owner.reference });
  }

  for (const appointment of raw.appointments) {
    if (!appointment.start || ["cancelled", "entered-in-error"].includes(appointment.status)) continue;
    events.push(event(appointment, appointment.start, "appointment-scheduled", appointment.description ?? "Appointment scheduled"));
  }

  for (const encounter of raw.encounters) {
    if (encounter.status !== "finished") continue;
    events.push(
      event(
        encounter,
        resourceTimestamp(encounter, encounter.period?.end ?? encounter.period?.start),
        "encounter-completed",
        encounter.type?.[0]?.text ?? "Clinical encounter completed",
      ),
    );
  }

  for (const communication of raw.communications) {
    if (communication.status !== "completed") continue;
    events.push(
      event(
        communication,
        resourceTimestamp(communication, communication.sent ?? communication.received),
        "communication-completed",
        communication.topic?.text ?? "Care communication completed",
      ),
    );
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

