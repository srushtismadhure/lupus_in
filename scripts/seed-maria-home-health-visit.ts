import { getFhirConfig } from "../src/lib/fhir-config.js";
import { executeFhirTransaction } from "../src/lib/fhir-server-client.js";

const patientId = "wp-copd-maria-pt-identity";
const encounterId = "wp-copd-maria-hh-sep8";
const questionnaireResponseId = "wp-copd-maria-copd-assessment-sep8";
const documentReferenceId = "wp-copd-maria-transcript-sep8";
const questionnaire = "https://waypoint.example/fhir/Questionnaire/copd-home-health-subset";
const oasisQuestionnaire = "https://waypoint.example/fhir/Questionnaire/oasis-e2-demo-subset";
const identifierSystem = "https://waypoint.example/fhir/identifier/home-health";

const transcript = `Synthetic reviewed home-health visit transcript.\n\nRESPIRATORY\nNurse: Since you came home, has your breathing been better, worse, or about the same?\nPatient: Worse. I get short of breath just walking to the kitchen.\n\nOXYGEN\nNurse: Are you using your oxygen at home?\nPatient: Yes, at night. Two liters.\n\nMEDICATION\nNurse: Are you still taking your maintenance inhaler every day?\nPatient: No. I ran out about a week ago.`;

function entry(resourceType: string, resource: fhir4.Resource): fhir4.BundleEntry {
  return { fullUrl: `urn:uuid:${resourceType}-${resource.id}`, resource, request: { method: "PUT", url: `${resourceType}/${resource.id}` } };
}

export async function seedMariaHomeHealthVisit() {
  const encounter: fhir4.Encounter = {
    resourceType: "Encounter", id: encounterId, identifier: [{ system: identifierSystem, value: "maria-home-health-sep8" }], status: "finished",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "HH", display: "Home health encounter" },
    type: [{ text: "Start of Care / post-discharge COPD home-health visit" }], subject: { reference: `Patient/${patientId}` },
    period: { start: "2026-09-08T10:00:00-07:00", end: "2026-09-08T11:00:00-07:00" },
  };
  const questionnaireResponse: fhir4.QuestionnaireResponse = {
    resourceType: "QuestionnaireResponse", id: questionnaireResponseId, identifier: { system: identifierSystem, value: "maria-copd-assessment-sep8" }, questionnaire,
    status: "completed", subject: { reference: `Patient/${patientId}` }, encounter: { reference: `Encounter/${encounterId}` }, authored: "2026-09-08T11:10:00-07:00", author: { display: "Waypoint Home Health RN" },
    item: [
      ["spo2", "SpO2", "90 %"], ["respiratory-rate", "Respiratory rate", "22 breaths/min"], ["mmrc", "mMRC dyspnea", "3"], ["breathing-baseline", "Breathing compared with baseline", "Worse"], ["dyspnea-activity", "Dyspnea with activity", "Severe"], ["oxygen-use", "Oxygen use", "Nocturnal"], ["oxygen-flow", "Oxygen flow rate", "2 L/min"], ["medication-use", "Maintenance inhaler patient-reported use", "Not currently taking; ran out"], ["functional", "Functional activity tolerance", "Dyspnea walking room-to-room"], ["pulmonology", "Pulmonology follow-up", "Not scheduled"], ["rehab", "Pulmonary rehabilitation", "Not documented"],
    ].map(([linkId, text, value]) => ({ linkId: linkId!, text: text!, answer: [{ valueString: value! }] })),
  };
  const oasisResponse: fhir4.QuestionnaireResponse = {
    resourceType: "QuestionnaireResponse", id: "wp-copd-maria-oasis-e2-sep8", identifier: { system: identifierSystem, value: "maria-oasis-e2-sep8" }, questionnaire: oasisQuestionnaire,
    status: "completed", subject: { reference: `Patient/${patientId}` }, encounter: { reference: `Encounter/${encounterId}` }, authored: "2026-09-08T11:15:00-07:00", author: { display: "Waypoint Home Health RN" },
    item: [["M1033", "Risk for hospitalization", "1"], ["M1400", "When is the patient dyspneic or noticeably short of breath?", "3"], ["N0415", "High-risk drug classes: use and indication", "1"], ["M2001", "Drug regimen review", "1"], ["O0100C", "Oxygen therapy", "1"]].map(([linkId, text, value]) => ({ linkId: linkId!, text: text!, answer: [{ valueString: value! }] })),
  };
  const documentReference: fhir4.DocumentReference = {
    resourceType: "DocumentReference", id: documentReferenceId, identifier: [{ system: identifierSystem, value: "maria-reviewed-transcript-sep8" }], status: "current", docStatus: "final", subject: { reference: `Patient/${patientId}` }, date: "2026-09-08T11:10:00-07:00", author: [{ display: "Waypoint Home Health RN" }], type: { text: "Reviewed home-health interview transcript" }, context: { encounter: [{ reference: `Encounter/${encounterId}` }] }, description: "Synthetic reviewed transcript; no original audio retained.", content: [{ attachment: { contentType: "text/plain", title: "Reviewed synthetic visit transcript", creation: "2026-09-08T11:10:00-07:00", data: Buffer.from(transcript).toString("base64") } }],
  };
  const result = await executeFhirTransaction<fhir4.Bundle | fhir4.OperationOutcome>({ resourceType: "Bundle", type: "transaction", entry: [entry("Encounter", encounter), entry("QuestionnaireResponse", questionnaireResponse), entry("QuestionnaireResponse", oasisResponse), entry("DocumentReference", documentReference)] });
  if (result.status !== 200 || result.body.resourceType !== "Bundle") throw new Error(`Maria visit seed failed (${result.status}).`);
  console.log(JSON.stringify({ fhirTarget: getFhirConfig().baseUrl, patientId, encounterId, questionnaireResponseId, oasisQuestionnaireResponseId: oasisResponse.id, documentReferenceId, status: "completed", rawAudio: "not retained" }, null, 2));
}

if (import.meta.main) seedMariaHomeHealthVisit().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
