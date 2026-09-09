import { applicable, assertVersion, itemById, registry, setCanonicalAnswer, skipState, valueIssues } from "./model";
import type { OasisAssessment } from "./model";

export type OasisCandidate = {
  targetQuestionnaire: "oasis-e2";
  version: string;
  timepoint: string;
  cmsItemId: string;
  linkId: string;
  candidateCmsValue: string;
  evidenceText: string;
  reviewStatus: "pending";
};
export function candidateIssues(input: unknown, transcript: string, assessment: OasisAssessment): string[] {
  assertVersion(assessment);
  if (!input || typeof input !== "object") return ["Malformed OASIS candidate."];
  const candidate = input as Partial<OasisCandidate>;
  const item = itemById.get(candidate.cmsItemId ?? "");
  if (!item || item.group !== "Asmt" || candidate.linkId !== item.cmsItemId) return ["Unknown clinical CMS item or mismatched FHIR linkId."];
  const issues: string[] = [];
  if (candidate.targetQuestionnaire !== "oasis-e2" || candidate.version !== assessment.version || candidate.timepoint !== assessment.timepoint || candidate.reviewStatus !== "pending") issues.push("Candidate version, timepoint, target, or review state is invalid.");
  if (!applicable(item, assessment.timepoint)) issues.push("CMS item is inactive at this timepoint.");
  issues.push(...valueIssues(item, candidate.candidateCmsValue).map(issue => issue.message));
  if (skipState(item, assessment.values) !== "enabled") issues.push("Skip dependencies must be resolved in the assessment before suggesting this item.");
  if (typeof candidate.evidenceText !== "string" || !candidate.evidenceText.trim() || !transcript.includes(candidate.evidenceText)) issues.push("Evidence must be an exact, nonempty excerpt of the reviewed transcript.");
  return issues;
}
export function acceptCandidate(assessment: OasisAssessment, candidate: OasisCandidate, transcript: string, nurseVerified: boolean, editedValue?: string): OasisAssessment {
  const reviewed = { ...candidate, candidateCmsValue: editedValue ?? candidate.candidateCmsValue };
  const issues = candidateIssues(reviewed, transcript, assessment);
  if (!nurseVerified) issues.push("A nurse must verify clinical sufficiency against the official assessment instructions.");
  if (issues.length) throw new Error(issues.join(" "));
  return setCanonicalAnswer(assessment, candidate.cmsItemId, reviewed.candidateCmsValue, { evidenceText: candidate.evidenceText, decision: editedValue !== undefined && editedValue !== candidate.candidateCmsValue ? "edited" : "accepted", reviewedAt: new Date().toISOString() });
}
export function extractionTargets(assessment: OasisAssessment) {
  assertVersion(assessment);
  return registry.items.filter(item => item.group === "Asmt" && applicable(item, assessment.timepoint) && skipState(item, assessment.values) === "enabled").map(item => ({
    cmsItemId: item.cmsItemId, linkId: item.cmsItemId, text: item.text, type: item.type, answerOptions: item.answerOptions,
    rules: item.editIds.map(id => registry.edits[id as keyof typeof registry.edits].text),
  }));
}
