import data from "./registry.generated.json";

export const registry = data;
export type OasisItem = (typeof registry.items)[number];
export const itemById = new Map(registry.items.map(item => [item.cmsItemId, item]));
export const OASIS_CANONICAL = `${registry.canonicalUrl}|${registry.version}`;
export const CMS_ITEM_SYSTEM = "https://waypoint.example/fhir/CodeSystem/cms-oasis-item";
export const EXT = "https://waypoint.example/fhir/StructureDefinition/oasis-";
export const timepoints = ["01", "03", "04", "05", "06", "07", "08", "09", "XX"] as const;
export type Timepoint = (typeof timepoints)[number];
export const clinicalTimepoints = registry.items.find(item => item.cmsItemId === "ITM_SBST_CD")!.answerOptions;
export type Review = { evidenceText: string; reviewedAt: string; decision: "accepted" | "edited" };
export type OasisAssessment = {
  instrument: "OASIS-E2";
  version: string;
  effectiveDate: string;
  questionnaire: string;
  timepoint: Timepoint;
  values: Record<string, string>;
  reviews: Record<string, Review>;
  context: Pick<fhir4.QuestionnaireResponse, "id" | "meta" | "subject" | "encounter" | "authored" | "author" | "source" | "status">;
};
export type Issue = { cmsItemId?: string; code: string; message: string };
export function newAssessment(patientId: string, timepoint: Timepoint = "01"): OasisAssessment {
  return { instrument: "OASIS-E2", version: registry.version, effectiveDate: registry.effectiveDate, questionnaire: OASIS_CANONICAL, timepoint, values: {}, reviews: {}, context: { status: "in-progress", subject: { reference: `Patient/${patientId}` } } };
}
export function assertVersion(assessment: OasisAssessment) {
  if (assessment.instrument !== registry.instrument || assessment.version !== registry.version || assessment.effectiveDate !== registry.effectiveDate || assessment.questionnaire !== OASIS_CANONICAL || !timepoints.includes(assessment.timepoint)) throw new Error("Unsupported OASIS assessment version or timepoint. Historical records must use their original registry.");
}
export function applicable(item: OasisItem, timepoint: Timepoint) { return item.applicableTimepoints.includes(timepoint); }
export function responseSystem(id: string) { return `${CMS_ITEM_SYSTEM}/${registry.version}/${id}`; }

// Only this exact official rule grammar is executable. Other prose is never guessed.
type SkipClause = { parent: string; when: string; target: string; skipped: boolean };
export function skipClauses(item: OasisItem): SkipClause[] | null {
  const clauses: SkipClause[] = [];
  for (const id of item.editIds) {
    const rule = registry.edits[id as keyof typeof registry.edits];
    if (rule.type !== "Skip pattern") continue;
    const parts = rule.text.split(/\([a-z]\)\s*/).filter(Boolean);
    for (const part of parts) {
      const match = /^If ([A-Z0-9_]+)=\[([^\]]+)\], then ([A-Z0-9_]+) must (not )?equal \[\^\]\.$/.exec(part.trim());
      if (!match || match[3] !== item.cmsItemId) return null;
      clauses.push({ parent: match[1]!, when: match[2]!, target: match[3]!, skipped: !match[4] });
    }
  }
  return clauses;
}
export function skipState(item: OasisItem, values: Record<string, string>): "skipped" | "enabled" | "unresolved" {
  const clauses = skipClauses(item);
  if (clauses === null) return "unresolved";
  if (!clauses.length) return "enabled";
  const matched = clauses.filter(clause => values[clause.parent] === clause.when);
  if (!matched.length) return "unresolved";
  return matched.some(clause => clause.skipped) ? "skipped" : "enabled";
}
export function valueIssues(item: OasisItem, value: unknown): Issue[] {
  const issue = (message: string): Issue[] => [{ cmsItemId: item.cmsItemId, code: "invalid-value", message }];
  if (typeof value !== "string" || !value.length) return issue("A nonempty, exact CMS lexical value is required.");
  if (value.length > Number(item.source.fixed_rec_lngth)) return issue("Value exceeds the CMS field length.");
  if (["Code", "Checklist"].includes(item.type)) return item.answerOptions.some(option => option.code === value) ? [] : issue("Value is not an official CMS response code.");
  const special = item.answerOptions.some(option => option.code === value && !["Minimum value", "Maximum value"].includes(option.display));
  if (special) return [];
  if (item.type === "Number") {
    if (!/^\d+$/.test(value)) return issue("CMS numeric value must retain its digit representation.");
    const min = item.answerOptions.find(option => option.display === "Minimum value");
    const max = item.answerOptions.find(option => option.display === "Maximum value");
    if ((min && Number(value) < Number(min.code)) || (max && Number(value) > Number(max.code))) return issue("Value is outside the CMS range.");
  }
  if (item.type === "Date") {
    if (!/^\d{8}$/.test(value)) return issue("CMS date must use YYYYMMDD or a permitted special code.");
    const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10).replaceAll("-", "") !== value) return issue("Invalid calendar date.");
  }
  return [];
}
export function validateAssessment(assessment: OasisAssessment, completing = false): Issue[] {
  assertVersion(assessment);
  const issues: Issue[] = [];
  for (const [id, value] of Object.entries(assessment.values)) {
    const item = itemById.get(id);
    if (!item) { issues.push({ cmsItemId: id, code: "unknown-item", message: "Unknown CMS element." }); continue; }
    issues.push(...valueIssues(item, value));
    // Inactive submission fields can carry the CMS caret sentinel, not clinical answers.
    if (!applicable(item, assessment.timepoint) && value !== "^") issues.push({ cmsItemId: id, code: "inapplicable", message: "Element is inactive at this timepoint." });
    const skip = skipState(item, assessment.values);
    if (skip === "skipped" && value !== "^") issues.push({ cmsItemId: id, code: "skip", message: "CMS skip rule requires ^." });
    if (skip === "enabled" && skipClauses(item)?.length && value === "^") issues.push({ cmsItemId: id, code: "skip", message: "CMS skip rule does not permit ^ for these answers." });
  }
  const control: Record<string, string> = { ASMT_SYS_CD: "OASIS", ITM_SET_VRSN_CD: "E2-042026", SPEC_VRSN_CD: "3.02", ITM_SBST_CD: assessment.timepoint };
  for (const [id, expected] of Object.entries(control)) if (assessment.values[id] !== undefined && assessment.values[id] !== expected) issues.push({ cmsItemId: id, code: "version-control", message: `CMS control value must be ${expected} for this assessment.` });
  if (completing) issues.push({ code: "validation-incomplete", message: "Completion is blocked: full CMS cross-item, requiredness, historical, and submission edits are not yet executable. This is not an iQIES submission payload." });
  return issues;
}
export function setCanonicalAnswer(assessment: OasisAssessment, id: string, value: string, review?: Review): OasisAssessment {
  assertVersion(assessment);
  if (assessment.context.status !== "in-progress") throw new Error("Historical or completed assessments are read-only.");
  const item = itemById.get(id);
  if (!item || !applicable(item, assessment.timepoint)) throw new Error("Unknown or inapplicable CMS item.");
  const issues = valueIssues(item, value);
  if (issues.length) throw new Error(issues[0]!.message);
  const next = { ...assessment, values: { ...assessment.values, [id]: value }, reviews: { ...assessment.reviews } };
  if (review) next.reviews[id] = review;
  else delete next.reviews[id];
  const invalid = validateAssessment(next).filter(issue => issue.cmsItemId === id);
  if (invalid.length) throw new Error(invalid[0]!.message);
  return next;
}

export function generateQuestionnaire(): fhir4.Questionnaire {
  return {
    resourceType: "Questionnaire", url: registry.canonicalUrl, version: registry.version, name: "OASISE2", title: "OASIS-E2 Assessment", status: "active",
    publisher: registry.publisher,
    description: registry.limitations.join(" "), copyright: registry.copyright,
    effectivePeriod: { start: registry.effectiveDate }, derivedFrom: [registry.sourceUrl],
    extension: [{ url: `${EXT}source-instrument`, valueString: registry.instrument }, { url: `${EXT}specification-version`, valueString: registry.specificationVersion }],
    item: [...new Set(registry.items.map(item => item.section))].map(section => ({
      linkId: `section-${section}`, text: section, type: "group",
      item: registry.items.filter(item => item.section === section).map(item => ({
        linkId: item.cmsItemId, text: item.text, type: ["Code", "Checklist"].includes(item.type) ? "choice" : "string", repeats: false,
        code: [{ system: CMS_ITEM_SYSTEM, code: item.cmsItemId }, ...(item.source.itm_loinc_id ? [{ system: "http://loinc.org", code: item.source.itm_loinc_id }] : [])],
        ...(skipClauses(item)?.length ? { enableWhen: skipClauses(item)!.map(clause => ({ question: clause.parent, operator: clause.skipped ? "=" : "!=", answerCoding: { system: responseSystem(clause.parent), code: clause.when } })), enableBehavior: "any" } : {}),
        maxLength: ["Code", "Checklist"].includes(item.type) ? undefined : Number(item.source.fixed_rec_lngth),
        extension: [{ url: `${EXT}cms-datatype`, valueCode: item.type }, { url: `${EXT}applicable-timepoints`, valueString: item.applicableTimepoints.join(",") },
          ...item.editIds.map(id => ({ url: `${EXT}cms-edit`, valueString: JSON.stringify(registry.edits[id as keyof typeof registry.edits]) }))],
        answerOption: ["Code", "Checklist"].includes(item.type) ? item.answerOptions.map(option => ({ valueCoding: { system: responseSystem(item.cmsItemId), code: option.code, display: option.display } })) : undefined,
      })),
    })),
  };
}

export function toQuestionnaireResponse(assessment: OasisAssessment): fhir4.QuestionnaireResponse {
  const issues = validateAssessment(assessment, ["completed", "amended"].includes(assessment.context.status));
  if (issues.length) throw new Error(issues.map(issue => `${issue.cmsItemId ?? "OASIS"}: ${issue.message}`).join("\n"));
  return { resourceType: "QuestionnaireResponse", ...assessment.context, questionnaire: assessment.questionnaire,
    extension: [{ url: `${EXT}timepoint`, valueCode: assessment.timepoint }, { url: `${EXT}effective-date`, valueDate: assessment.effectiveDate }, { url: `${EXT}instrument`, valueString: assessment.instrument }],
    item: [...new Set(registry.items.filter(item => assessment.values[item.cmsItemId] !== undefined).map(item => item.section))].map(section => ({
      linkId: `section-${section}`, text: section,
      item: registry.items.filter(item => item.section === section && assessment.values[item.cmsItemId] !== undefined).map(item => {
        const value = assessment.values[item.cmsItemId]!;
        const review = assessment.reviews[item.cmsItemId];
        return { linkId: item.cmsItemId, text: item.text, answer: [{
          ...(["Code", "Checklist"].includes(item.type) ? { valueCoding: { system: responseSystem(item.cmsItemId), code: value, display: item.answerOptions.find(option => option.code === value)?.display } } : { valueString: value }),
          ...(review ? { extension: [{ url: `${EXT}nurse-review`, valueString: JSON.stringify(review) }] } : {}),
        }] };
      }),
    })),
  };
}
export function fromQuestionnaireResponse(response: fhir4.QuestionnaireResponse): OasisAssessment {
  if (response.questionnaire !== OASIS_CANONICAL) throw new Error("Unsupported or legacy OASIS Questionnaire; no automatic conversion is safe.");
  const extension = (suffix: string) => {
    const found = response.extension?.filter(ext => ext.url === `${EXT}${suffix}`) ?? [];
    if (found.length !== 1) throw new Error(`Missing or ambiguous OASIS ${suffix}.`);
    return found[0]!;
  };
  const assessment: OasisAssessment = { instrument: extension("instrument").valueString as "OASIS-E2", version: registry.version, effectiveDate: extension("effective-date").valueDate!, questionnaire: response.questionnaire, timepoint: extension("timepoint").valueCode as Timepoint,
    values: {}, reviews: {}, context: { status: response.status, ...(response.id ? { id: response.id } : {}), ...(response.meta ? { meta: response.meta } : {}), ...(response.subject ? { subject: response.subject } : {}), ...(response.encounter ? { encounter: response.encounter } : {}), ...(response.authored ? { authored: response.authored } : {}), ...(response.author ? { author: response.author } : {}), ...(response.source ? { source: response.source } : {}) } };
  assertVersion(assessment);
  const seen = new Set<string>();
  for (const group of response.item ?? []) {
    if (!group.linkId.startsWith("section-") || group.answer?.length || seen.has(group.linkId)) throw new Error("Unexpected or duplicate OASIS group.");
    seen.add(group.linkId);
    for (const leaf of group.item ?? []) {
      const item = itemById.get(leaf.linkId);
      if (!item || group.linkId !== `section-${item.section}` || seen.has(leaf.linkId) || leaf.item?.length) throw new Error("Unknown, duplicate, or misplaced OASIS element.");
      seen.add(leaf.linkId);
      if (!leaf.answer?.length) continue;
      if (leaf.answer.length !== 1) throw new Error("CMS data elements have one lexical value; matrix/checklist cells are separate elements.");
      const answer = leaf.answer[0]!;
      const coding = ["Code", "Checklist"].includes(item.type);
      if (Object.keys(answer).filter(key => key.startsWith("value")).length !== 1 || answer.item?.length) throw new Error("Ambiguous OASIS answer.");
      if (coding && answer.valueCoding?.system !== responseSystem(item.cmsItemId)) throw new Error("OASIS coding system mismatch.");
      const value = coding ? answer.valueCoding?.code : answer.valueString;
      if (value === undefined) throw new Error("OASIS answer datatype mismatch.");
      assessment.values[item.cmsItemId] = value;
      for (const ext of answer.extension ?? []) {
        if (ext.url !== `${EXT}nurse-review` || !ext.valueString || assessment.reviews[item.cmsItemId]) throw new Error("Unsupported OASIS answer extension.");
        const review = JSON.parse(ext.valueString) as Review;
        if (typeof review.evidenceText !== "string" || !review.evidenceText.trim() || !["accepted", "edited"].includes(review.decision) || !review.reviewedAt || Number.isNaN(Date.parse(review.reviewedAt))) throw new Error("Invalid nurse review provenance.");
        assessment.reviews[item.cmsItemId] = review;
      }
    }
  }
  const issues = validateAssessment(assessment);
  if (issues.length) throw new Error(issues.map(issue => issue.message).join("\n"));
  return assessment;
}

// A structured audit representation, deliberately not a fabricated CMS upload format.
export type CmsRepresentation = Omit<OasisAssessment, "values"> & { label: "CMS OASIS-E2 structured representation"; submissionReady: false; elements: { cmsItemId: string; cmsValue: string; display?: string }[] };
export function toCms(assessment: OasisAssessment): CmsRepresentation {
  const issues = validateAssessment(assessment, ["completed", "amended"].includes(assessment.context.status));
  if (issues.length) throw new Error(issues.map(issue => issue.message).join("\n"));
  const { values, ...metadata } = assessment;
  return { ...metadata, label: "CMS OASIS-E2 structured representation", submissionReady: false,
    elements: registry.items.filter(item => values[item.cmsItemId] !== undefined).map(item => ({ cmsItemId: item.cmsItemId, cmsValue: values[item.cmsItemId]!, display: item.answerOptions.find(option => option.code === values[item.cmsItemId])?.display })) };
}
export function fromCms(cms: CmsRepresentation): OasisAssessment {
  const { label, submissionReady, elements, ...metadata } = cms;
  if (label !== "CMS OASIS-E2 structured representation" || submissionReady !== false || !Array.isArray(elements)) throw new Error("Unsupported CMS representation.");
  const values: Record<string, string> = {};
  for (const element of elements) {
    if (Object.hasOwn(values, element.cmsItemId)) throw new Error("Duplicate CMS element.");
    values[element.cmsItemId] = element.cmsValue;
  }
  const assessment = { ...metadata, values };
  const issues = validateAssessment(assessment, ["completed", "amended"].includes(assessment.context.status));
  if (issues.length) throw new Error(issues.map(issue => issue.message).join("\n"));
  return assessment;
}
export function mappingReport() {
  const questionnaire = generateQuestionnaire();
  const leaves = questionnaire.item!.flatMap(group => group.item!);
  return { source: registry.sourceUrl, version: registry.version, cmsElements: registry.items.length, fhirAnswerItems: leaves.length, oneToOne: leaves.filter(item => itemById.has(item.linkId)).length,
    fhirGroupItems: questionnaire.item!.length, fhirTotalItems: leaves.length + questionnaire.item!.length,
    activeClinicalElements: registry.items.filter(item => item.group === "Asmt" && item.applicableTimepoints.length).length,
    nestedRepresentation: "Section groups only. Multi-select and matrix cells retain individual CMS element IDs and scalar codes.",
    lexicalStringItems: registry.items.filter(item => !["Code", "Checklist"].includes(item.type)).length,
    lexicalNote: "CMS Number/Date/Text/ICD/Filler use FHIR string with cms-datatype extension; this preserves padding and special codes without numeric/date coercion.",
    officialEdits: Object.keys(registry.edits).length, validationComplete: false, submissionReady: false, limitations: registry.limitations };
}
