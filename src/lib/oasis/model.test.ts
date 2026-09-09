import { describe, expect, test } from "bun:test";
import { candidateIssues } from "./candidates";
import {
  applicable,
  fromCms,
  fromQuestionnaireResponse,
  generateQuestionnaire,
  mappingReport,
  newAssessment,
  OASIS_CANONICAL,
  registry,
  setCanonicalAnswer,
  skipClauses,
  toCms,
  toQuestionnaireResponse,
} from "./model";

function itemWithCode(code: string) {
  const item = registry.items.find(candidate => candidate.group === "Asmt" && applicable(candidate, "01") && candidate.answerOptions.some(option => option.code === code));
  if (!item) throw new Error(`Registry fixture not found for CMS code ${code}`);
  return item;
}

function assessmentWithAnswers() {
  const coded = itemWithCode("3");
  const text = registry.items.find(item => item.group === "Asmt" && applicable(item, "01") && item.type === "Text");
  if (!text) throw new Error("Registry fixture not found for text item");
  let assessment = newAssessment("patient-1");
  assessment = setCanonicalAnswer(assessment, coded.cmsItemId, "3");
  assessment = setCanonicalAnswer(assessment, text.cmsItemId, "x");
  return { assessment, coded, text };
}

describe("canonical OASIS CMS/FHIR model", () => {
  test("generates a CMS-attributed Questionnaire with a one-to-one item map", () => {
    const questionnaire = generateQuestionnaire();
    const leaves = questionnaire.item?.flatMap(group => group.item ?? []) ?? [];
    const report = mappingReport();

    expect(questionnaire.url).toBe(registry.canonicalUrl);
    expect(questionnaire.version).toBe(registry.version);
    expect(questionnaire.publisher).toBe("Centers for Medicare & Medicaid Services");
    expect(leaves).toHaveLength(registry.items.length);
    expect(new Set(leaves.map(item => item.linkId)).size).toBe(registry.items.length);
    expect(leaves.every(item => item.code?.some(code => code.system === "https://waypoint.example/fhir/CodeSystem/cms-oasis-item" && code.code === item.linkId))).toBe(true);
    expect(report.cmsElements).toBe(report.fhirAnswerItems);
    expect(report.oneToOne).toBe(registry.items.length);
  });

  test("preserves coded CMS values through CMS and FHIR round trips", () => {
    const { assessment, coded } = assessmentWithAnswers();
    const cms = toCms(assessment);
    const fromCmsAssessment = fromCms(cms);
    const response = toQuestionnaireResponse(fromCmsAssessment);
    const fromFhirAssessment = fromQuestionnaireResponse(response);

    expect(cms.elements.find(element => element.cmsItemId === coded.cmsItemId)?.cmsValue).toBe("3");
    expect(response.questionnaire).toBe(OASIS_CANONICAL);
    const leaf = response.item?.flatMap(group => group.item ?? []).find(item => item.linkId === coded.cmsItemId);
    expect(leaf?.answer?.[0]?.valueCoding?.code).toBe("3");
    expect(fromFhirAssessment.values).toEqual(assessment.values);
    expect(toCms(fromFhirAssessment).elements).toEqual(cms.elements);
  });

  test("keeps FHIR QuestionnaireResponse structure stable across both directions", () => {
    const { assessment } = assessmentWithAnswers();
    const first = toQuestionnaireResponse(assessment);
    const second = toQuestionnaireResponse(fromQuestionnaireResponse(first));
    expect(second.questionnaire).toBe(first.questionnaire);
    expect(second.item).toEqual(first.item);
  });

  test("preserves multiple checklist or matrix cell codes independently", () => {
    const cells = registry.items.filter(item => item.group === "Asmt" && applicable(item, "01") && item.type === "Checklist" && item.answerOptions.length > 0).slice(0, 2);
    if (cells.length < 2) throw new Error("Registry fixture does not contain two checklist cells");
    let assessment = newAssessment("patient-1");
    for (const [index, cell] of cells.entries()) assessment = setCanonicalAnswer(assessment, cell.cmsItemId, cell.answerOptions[index % cell.answerOptions.length]!.code);
    const roundTripped = fromQuestionnaireResponse(toQuestionnaireResponse(assessment));
    expect(roundTripped.values).toEqual(assessment.values);
  });

  test("carries timepoint applicability and supported skip rules into FHIR", () => {
    const questionnaire = generateQuestionnaire();
    const leaves = questionnaire.item?.flatMap(group => group.item ?? []) ?? [];
    for (const item of registry.items) {
      const fhirItem = leaves.find(candidate => candidate.linkId === item.cmsItemId);
      expect(fhirItem?.extension?.some(extension => extension.url.endsWith("applicable-timepoints") && extension.valueString === item.applicableTimepoints.join(","))).toBe(true);
      const clauses = skipClauses(item);
      if (clauses?.length) expect(fhirItem?.enableWhen).toHaveLength(clauses.length);
    }
  });

  test("keeps the CMS boundary explicitly non-submission-ready", () => {
    const { assessment } = assessmentWithAnswers();
    const cms = toCms(assessment);
    expect(cms.label).toBe("CMS OASIS-E2 structured representation");
    expect(cms.submissionReady).toBe(false);
  });

  test("accepts only registry-valid scribe candidates", () => {
    const { assessment, coded } = assessmentWithAnswers();
    const candidate = { targetQuestionnaire: "oasis-e2", version: assessment.version, timepoint: assessment.timepoint, cmsItemId: coded.cmsItemId, linkId: coded.cmsItemId, candidateCmsValue: "3", evidenceText: "shortness of breath", reviewStatus: "pending" };
    expect(candidateIssues(candidate, "Patient reports shortness of breath", assessment)).toEqual([]);
    expect(candidateIssues({ ...candidate, cmsItemId: "MISSING", linkId: "MISSING" }, "Patient reports shortness of breath", assessment).length).toBeGreaterThan(0);
    expect(candidateIssues({ ...candidate, candidateCmsValue: "not-a-code" }, "Patient reports shortness of breath", assessment).length).toBeGreaterThan(0);
  });
});
