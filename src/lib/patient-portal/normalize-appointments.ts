import type { PatientAppointment } from "./types.js";

function display(reference: fhir4.Reference | undefined, fallback: string): string {
  return reference?.display ?? fallback;
}

function patientStatus(status: fhir4.Appointment["status"]): string {
  if (status === "booked") return "Scheduled";
  if (status === "pending" || status === "proposed") return "Needs confirmation";
  if (status === "fulfilled" || status === "arrived" || status === "checked-in") return "Completed or checked in";
  if (status === "cancelled" || status === "noshow") return "Not completed";
  return "Scheduling update available";
}

export function normalizeAppointments(appointments: fhir4.Appointment[], now = new Date()): PatientAppointment[] {
  return appointments
    .filter(item => item.status !== "entered-in-error")
    .map(appointment => {
      const nonPatient = (appointment.participant ?? []).filter(item => !item.actor?.reference?.includes("Patient/"));
      const provider = nonPatient.find(item => item.actor?.reference?.includes("Practitioner"))?.actor;
      const organization = nonPatient.find(item => item.actor?.reference?.includes("Organization/"))?.actor;
      const location = nonPatient.find(item => item.actor?.reference?.includes("Location/"))?.actor;
      const telehealthUrl = appointment.extension
        ?.map(extension => ("valueUrl" in extension ? extension.valueUrl : undefined))
        .find((url): url is string => typeof url === "string" && /^https:\/\//.test(url));
      return {
        id: appointment.id ?? `appointment-${appointment.start ?? "unscheduled"}`,
        title: appointment.description ?? appointment.serviceType?.[0]?.text ?? "Care appointment",
        status: appointment.status,
        statusLabel: patientStatus(appointment.status),
        start: appointment.start,
        end: appointment.end,
        provider: display(provider, "Care team provider"),
        organization: organization?.display,
        location: location?.display,
        telehealthUrl,
        preparation: appointment.comment ? [appointment.comment] : [],
        pathway: appointment.basedOn?.[0]?.display,
        past: Boolean(appointment.start && new Date(appointment.start).getTime() < now.getTime()),
      } satisfies PatientAppointment;
    })
    .sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999"));
}

