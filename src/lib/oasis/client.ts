import { fromQuestionnaireResponse, toQuestionnaireResponse } from "./model";
import type { OasisAssessment } from "./model";

export async function saveOasisDraft(assessment: OasisAssessment): Promise<OasisAssessment> {
  if (assessment.context.status !== "in-progress") throw new Error("Only OASIS drafts may be saved.");
  const resource = toQuestionnaireResponse({ ...assessment, context: { ...assessment.context, authored: new Date().toISOString() } });
  const version = assessment.context.meta?.versionId;
  if (resource.id && !version) throw new Error("Reload the assessment before saving: its FHIR version is missing.");
  const response = await fetch(`/fhir/QuestionnaireResponse${resource.id ? `/${encodeURIComponent(resource.id)}` : ""}`, {
    method: resource.id ? "PUT" : "POST",
    headers: { "Content-Type": "application/fhir+json", Accept: "application/fhir+json", Prefer: "return=representation", ...(version ? { "If-Match": `W/\"${version}\"` } : {}) },
    body: JSON.stringify(resource),
  });
  if (response.status === 412) throw new Error("This assessment changed elsewhere. Reload before reviewing or saving more answers.");
  if (response.status === 401) throw new Error("Your session has expired. Sign in before saving.");
  if (!response.ok) throw new Error(`Unable to save OASIS draft (${response.status}). Your changes have not been confirmed saved.`);
  const saved = fromQuestionnaireResponse(await response.json());
  if (!saved.context.id || saved.context.subject?.reference !== assessment.context.subject?.reference) throw new Error("FHIR server returned an unexpected assessment.");
  return saved;
}
