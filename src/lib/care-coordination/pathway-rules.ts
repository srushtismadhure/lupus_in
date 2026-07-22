import { LOINC_CODES, getLatestObservation, getObservationEffectiveDate, getObservationQuantityValue } from "../fhir-observations.js";
import { formatConditionText, formatObservationName, isChronicKidneyDiseaseCondition, isLupusNephritisCondition } from "../formatters.js";
import type { CareCoordinationRawData, CareEvidence, CarePathwayProposal, CarePathwayType } from "./types.js";

export const CARE_PATHWAY_RULE_VERSION = "1.0.0";
const FOLLOW_UP_INTERVAL_DAYS = 90;

function codeValues(resource: { code?: fhir4.CodeableConcept }): string[] {
  return resource.code?.coding?.map(coding => coding.code).filter((code): code is string => Boolean(code)) ?? [];
}

function serviceText(request: fhir4.ServiceRequest): string {
  return `${request.code?.text ?? ""} ${request.code?.coding?.map(coding => `${coding.code ?? ""} ${coding.display ?? ""}`).join(" ") ?? ""}`.toLowerCase();
}

export function pathwayTypeForServiceRequest(request: fhir4.ServiceRequest): CarePathwayType {
  const text = serviceText(request);
  if (text.includes("nutrition") || text.includes("dietitian") || text.includes("mnt")) return "medical-nutrition-therapy";
  if (text.includes("transplant") && (text.includes("evaluation") || text.includes("referral"))) return "kidney-transplant-evaluation";
  if (text.includes("dialysis")) return "dialysis-planning";
  if (text.includes("renal") && (text.includes("nurse") || text.includes("follow-up") || text.includes("follow up"))) {
    return "renal-nurse-follow-up";
  }
  return "generic";
}

function hasActiveRequest(raw: CareCoordinationRawData, pathwayType: Exclude<CarePathwayType, "generic">): boolean {
  return raw.serviceRequests.some(
    request =>
      pathwayTypeForServiceRequest(request) === pathwayType &&
      !["completed", "revoked", "entered-in-error"].includes(request.status),
  );
}

function reference(resource: fhir4.Resource): string | undefined {
  return resource.id ? `${resource.resourceType}/${resource.id}` : undefined;
}

function conditionEvidence(condition: fhir4.Condition): CareEvidence {
  const coding = condition.code?.coding?.[0];
  return {
    label: formatConditionText(condition),
    resourceReference: reference(condition),
    date: condition.onsetDateTime ?? condition.recordedDate,
    code: coding?.code,
    codeSystem: coding?.system,
  };
}

function observationEvidence(observation: fhir4.Observation): CareEvidence {
  const quantity = getObservationQuantityValue(observation);
  const coding = observation.code.coding?.[0];
  return {
    label: formatObservationName(observation),
    resourceReference: reference(observation),
    value: quantity ? `${quantity.value}${quantity.unit ? ` ${quantity.unit}` : ""}` : observation.valueCodeableConcept?.text,
    date: getObservationEffectiveDate(observation),
    code: coding?.code,
    codeSystem: coding?.system,
  };
}

function observationsByLoinc(raw: CareCoordinationRawData, code: string): fhir4.Observation[] {
  return raw.observations.filter(observation =>
    observation.code.coding?.some(coding => coding.code === code && (!coding.system || coding.system === "http://loinc.org")),
  );
}

function latestRenalEvidence(raw: CareCoordinationRawData): CareEvidence[] {
  return [LOINC_CODES.egfr, LOINC_CODES.upcr, LOINC_CODES.serumCreatinine, LOINC_CODES.serumAlbumin]
    .map(code => getLatestObservation(observationsByLoinc(raw, code)))
    .filter((observation): observation is fhir4.Observation => Boolean(observation))
    .map(observationEvidence);
}

function hasRecentDietitianEncounter(raw: CareCoordinationRawData, now: Date): boolean {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  return raw.encounters.some(encounter => {
    const text = `${encounter.type?.flatMap(type => [type.text, ...(type.coding?.map(coding => coding.display) ?? [])]).join(" ") ?? ""} ${
      encounter.participant?.map(participant => participant.individual?.display).join(" ") ?? ""
    }`.toLowerCase();
    const date = encounter.period?.end ?? encounter.period?.start;
    return (text.includes("diet") || text.includes("nutrition")) && Boolean(date && new Date(date) >= cutoff);
  });
}

function advancedKidneyEvidence(raw: CareCoordinationRawData): { supported: boolean; evidence: CareEvidence[] } {
  const advancedConditions = raw.conditions.filter(condition => {
    const text = formatConditionText(condition).toLowerCase();
    const codes = codeValues(condition);
    return (
      text.includes("kidney failure") ||
      text.includes("end stage renal") ||
      text.includes("stage 4 chronic kidney") ||
      text.includes("stage 5 chronic kidney") ||
      codes.some(code => ["N18.4", "N18.5", "N18.6"].includes(code))
    );
  });
  const egfr = getLatestObservation(observationsByLoinc(raw, LOINC_CODES.egfr));
  const egfrValue = egfr?.valueQuantity?.value;
  const evidence = [...advancedConditions.map(conditionEvidence), ...(egfr && egfrValue !== undefined && egfrValue < 30 ? [observationEvidence(egfr)] : [])];
  return { supported: advancedConditions.length > 0 || (egfrValue !== undefined && egfrValue < 30), evidence };
}

function dialysisEvidence(raw: CareCoordinationRawData): { supported: boolean; evidence: CareEvidence[] } {
  const documented = raw.conditions.filter(condition => {
    const text = formatConditionText(condition).toLowerCase();
    return text.includes("dialysis") || text.includes("kidney failure") || text.includes("end stage renal");
  });
  const egfr = getLatestObservation(observationsByLoinc(raw, LOINC_CODES.egfr));
  const egfrValue = egfr?.valueQuantity?.value;
  const evidence = [...documented.map(conditionEvidence), ...(egfr && egfrValue !== undefined && egfrValue < 15 ? [observationEvidence(egfr)] : [])];
  return { supported: documented.length > 0 || (egfrValue !== undefined && egfrValue < 15), evidence };
}

function daysBetween(earlier: string, later: Date): number {
  return Math.floor((later.getTime() - new Date(earlier).getTime()) / 86_400_000);
}

export interface PathwayRuleResult {
  proposals: CarePathwayProposal[];
  insufficientEvidence: string[];
}

export function evaluateCarePathwayRules(raw: CareCoordinationRawData, now = new Date()): PathwayRuleResult {
  const proposals: CarePathwayProposal[] = [];
  const insufficientEvidence: string[] = [];
  const renalConditions = raw.conditions.filter(condition => isLupusNephritisCondition(condition) || isChronicKidneyDiseaseCondition(condition));
  const evidence = [...renalConditions.map(conditionEvidence), ...latestRenalEvidence(raw)];

  if (raw.failedSections.includes("Condition") || raw.failedSections.includes("Observation")) {
    insufficientEvidence.push("Clinical pathway rules could not evaluate all renal diagnoses and laboratory evidence.");
  }

  if (renalConditions.length > 0 && !hasActiveRequest(raw, "medical-nutrition-therapy") && !hasRecentDietitianEncounter(raw, now)) {
    proposals.push({
      pathwayType: "medical-nutrition-therapy",
      reason: "Renal disease is documented and no recent renal dietitian encounter or active nutrition referral was found.",
      evidence,
      urgency: "routine",
      requiresClinicianApproval: true,
      sourceRuleId: "cc-mnt-gap",
      ruleVersion: CARE_PATHWAY_RULE_VERSION,
    });
  }

  const advanced = advancedKidneyEvidence(raw);
  if (advanced.supported && !hasActiveRequest(raw, "kidney-transplant-evaluation")) {
    proposals.push({
      pathwayType: "kidney-transplant-evaluation",
      reason: "Documented advanced kidney-disease evidence supports clinician review for transplant-evaluation referral.",
      evidence: advanced.evidence,
      urgency: "soon",
      requiresClinicianApproval: true,
      sourceRuleId: "cc-transplant-review-gap",
      ruleVersion: CARE_PATHWAY_RULE_VERSION,
    });
  } else if (raw.conditions.length === 0 && raw.observations.length === 0) {
    insufficientEvidence.push("Transplant relevance could not be assessed because kidney-disease evidence was unavailable.");
  }

  const dialysis = dialysisEvidence(raw);
  if (dialysis.supported && !hasActiveRequest(raw, "dialysis-planning")) {
    proposals.push({
      pathwayType: "dialysis-planning",
      reason: "Documented kidney-failure or dialysis-relevant evidence supports clinician review for planning and education.",
      evidence: dialysis.evidence,
      urgency: "soon",
      requiresClinicianApproval: true,
      sourceRuleId: "cc-dialysis-planning-gap",
      ruleVersion: CARE_PATHWAY_RULE_VERSION,
    });
  } else if (raw.conditions.length === 0 && raw.observations.length === 0) {
    insufficientEvidence.push("Dialysis-planning relevance could not be assessed because kidney-disease evidence was unavailable.");
  }

  const latestRenalObservation = [...latestRenalEvidence(raw)]
    .filter(item => item.date)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .pop();
  if (
    renalConditions.length > 0 &&
    latestRenalObservation?.date &&
    daysBetween(latestRenalObservation.date, now) > FOLLOW_UP_INTERVAL_DAYS &&
    !hasActiveRequest(raw, "renal-nurse-follow-up")
  ) {
    proposals.push({
      pathwayType: "renal-nurse-follow-up",
      reason: "The latest renal monitoring result is older than the configured follow-up interval.",
      evidence: [latestRenalObservation, ...renalConditions.map(conditionEvidence)],
      urgency: "soon",
      requiresClinicianApproval: true,
      sourceRuleId: "cc-renal-monitoring-overdue",
      ruleVersion: CARE_PATHWAY_RULE_VERSION,
    });
  } else if (renalConditions.length > 0 && !latestRenalObservation) {
    insufficientEvidence.push("Renal nurse follow-up timing could not be assessed because no dated renal result was available.");
  }

  return { proposals, insufficientEvidence: [...new Set(insufficientEvidence)] };
}

