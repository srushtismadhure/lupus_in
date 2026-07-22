import { formatConditionText, isLupusNephritisCondition } from "../formatters.js";
import type { PatientFriendlyLabResult, LupusSystemOverview } from "./types.js";

interface SystemDefinition {
  id: string;
  title: string;
  keywords: string[];
  meaning: string;
}

const SYSTEMS: SystemDefinition[] = [
  { id: "kidneys", title: "Kidneys", keywords: ["lupus nephritis", "kidney", "renal"], meaning: "Kidney monitoring may include blood tests, urine tests, blood pressure, medicines, and follow-up visits." },
  { id: "joints", title: "Joints and muscles", keywords: ["arthritis", "arthralgia", "joint", "myalgia", "muscle"], meaning: "Your care team may track pain, swelling, stiffness, strength, and daily function." },
  { id: "skin", title: "Skin", keywords: ["rash", "cutaneous", "skin", "photosens"], meaning: "Skin monitoring can include rashes, sun sensitivity, and dermatology follow-up." },
  { id: "blood", title: "Blood", keywords: ["anemia", "leukopen", "thrombocyt", "blood"], meaning: "Blood-count monitoring looks at red cells, white cells, and platelets." },
  { id: "heart-lungs", title: "Heart and lungs", keywords: ["pericard", "pleur", "cardiac", "pulmonary", "lung"], meaning: "Only documented heart or lung conditions and follow-up are shown here." },
  { id: "nervous-system", title: "Nervous system", keywords: ["seizure", "neurolog", "neuropathy", "cognitive"], meaning: "Only documented nervous-system conditions and care are shown here." },
  { id: "general", title: "General symptoms", keywords: ["fatigue", "fever", "weight"], meaning: "General symptoms can have many causes and should be interpreted with your care team." },
  { id: "medication-monitoring", title: "Medication monitoring", keywords: [], meaning: "Your care team may order laboratory or visit follow-up for medicines in your treatment plan." },
];

export function normalizeLupusOverview(
  conditions: fhir4.Condition[],
  labs: PatientFriendlyLabResult[],
  activeMedicationCount: number,
): LupusSystemOverview[] {
  const conditionTexts = conditions.map(condition => ({ condition, text: formatConditionText(condition).toLowerCase() }));
  return SYSTEMS.map(system => {
    const matches = system.id === "kidneys"
      ? conditionTexts.filter(item => isLupusNephritisCondition(item.condition) || item.text.includes("kidney"))
      : conditionTexts.filter(item => system.keywords.some(keyword => item.text.includes(keyword)));
    const monitoredLabs = system.id === "kidneys"
      ? labs.filter(lab => lab.category === "kidney-function" || lab.category === "urine-protein")
      : system.id === "blood"
        ? labs.filter(lab => lab.category === "blood-count")
        : [];
    const medicationMonitoring = system.id === "medication-monitoring" && activeMedicationCount > 0;
    const supported = matches.length > 0 || monitoredLabs.length > 0 || medicationMonitoring;
    const status = matches.length > 0
      ? "active-issue"
      : supported
        ? "being-monitored"
        : "insufficient-information";
    const statusLabel = status === "active-issue" ? "Active issue documented" : status === "being-monitored" ? "Being monitored" : "Not enough recent information";
    return {
      id: system.id,
      title: system.title,
      status,
      statusLabel,
      summary: matches.length > 0 ? matches.map(item => formatConditionText(item.condition)).join("; ") : system.meaning,
      monitoredItems: [
        ...monitoredLabs.map(lab => lab.plainLanguageName),
        ...(medicationMonitoring ? ["Medication safety and laboratory monitoring"] : []),
      ],
      latestInformation: monitoredLabs.slice(0, 3).map(lab => `${lab.plainLanguageName}: ${lab.value ?? "not available"}${lab.unit ? ` ${lab.unit}` : ""}`),
      nextStep: supported ? "Follow the next step documented in your care plan and ask your care team about new symptoms." : "Ask your care team what monitoring applies to this area.",
      questions: ["What changes should I report?", "When will this area be reviewed again?"],
    } satisfies LupusSystemOverview;
  });
}

