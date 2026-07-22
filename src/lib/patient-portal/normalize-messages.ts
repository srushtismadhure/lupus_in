import type { PatientMessageSummary } from "./types.js";

function payloadText(communication: fhir4.Communication): string {
  return communication.payload?.map(item => item.contentString).filter(Boolean).join(" ") ?? "Message content is not available.";
}

export function normalizePatientMessages(communications: fhir4.Communication[], patientId: string): PatientMessageSummary[] {
  return communications
    .filter(communication => {
      const senderIsPatient = communication.sender?.reference?.endsWith(`/Patient/${patientId}`) || communication.sender?.reference === `Patient/${patientId}`;
      const recipientIsPatient = communication.recipient?.some(item => item.reference?.endsWith(`/Patient/${patientId}`) || item.reference === `Patient/${patientId}`);
      const portalCategory = communication.category?.some(category =>
        category.coding?.some(coding => coding.system === "https://luppedin.health/fhir/CodeSystem/patient-portal"),
      );
      return senderIsPatient || recipientIsPatient || portalCategory;
    })
    .map(communication => {
      const senderIsPatient = communication.sender?.reference?.endsWith(`/Patient/${patientId}`) || communication.sender?.reference === `Patient/${patientId}`;
      const content = payloadText(communication);
      return {
        id: communication.id ?? `message-${communication.sent ?? "undated"}`,
        subject: communication.topic?.text ?? "Care-team message",
        sender: senderIsPatient ? "You" : communication.sender?.display ?? "Care team",
        sent: communication.sent ?? communication.received,
        direction: senderIsPatient ? "sent" : "inbox",
        preview: content.length > 140 ? `${content.slice(0, 137)}...` : content,
      } satisfies PatientMessageSummary;
    })
    .sort((a, b) => (b.sent ?? "").localeCompare(a.sent ?? ""));
}

