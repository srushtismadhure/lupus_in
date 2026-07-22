import type { SleSystemDefinition, SleSystemId } from "./types.js";

export const SLE_SYSTEM_DEFINITIONS: SleSystemDefinition[] = [
  {
    id: "constitutional",
    title: "Constitutional",
    shortLabel: "Whole body",
    bodyRegions: ["whole-body"],
    description: "General symptoms and systemic findings documented in the record.",
    evidenceKeywords: ["fatigue", "fever", "weight change", "weight loss", "malaise", "constitutional"],
    checklist: [
      { id: "fever", label: "Fever reviewed", evidenceKeywords: ["fever", "temperature"] },
      { id: "fatigue", label: "Fatigue reviewed", evidenceKeywords: ["fatigue", "malaise"] },
      { id: "weight", label: "Weight change reviewed", evidenceKeywords: ["weight", "body weight"] },
      { id: "functional-status", label: "Functional status reviewed", evidenceKeywords: ["functional status", "activities of daily living"] },
    ],
  },
  {
    id: "renal",
    title: "Renal",
    shortLabel: "Kidneys",
    bodyRegions: ["kidneys"],
    description: "Kidney involvement, urine findings, renal monitoring, biopsy history, and follow-up.",
    evidenceKeywords: ["renal", "kidney", "nephritis", "proteinuria", "urine protein", "upcr", "creatinine", "egfr", "glomerul", "urine sediment", "hematuria", "red blood cell cast"],
    checklist: [
      { id: "proteinuria", label: "Proteinuria reviewed", evidenceKeywords: ["proteinuria", "urine protein", "upcr", "2890-2"] },
      { id: "creatinine", label: "Creatinine reviewed", evidenceKeywords: ["creatinine", "2160-0", "egfr", "98979-8"] },
      { id: "blood-pressure", label: "Blood pressure reviewed", evidenceKeywords: ["blood pressure", "85354-9", "8480-6", "8462-4"] },
      { id: "complement", label: "Complement reviewed", evidenceKeywords: ["complement", "c3", "c4", "4485-9", "4498-2", "anti-dsdna", "5130-0"] },
      { id: "urine-sediment", label: "Urine sediment reviewed", evidenceKeywords: ["urine sediment", "urine red blood", "hematuria", "red blood cell cast", "urine-rbc"] },
      { id: "medication-adherence", label: "Medication adherence reviewed", evidenceKeywords: ["medication adherence", "adherence issue", "missed dose", "refill issue"] },
      { id: "nephrology-follow-up", label: "Nephrology follow-up reviewed", evidenceKeywords: ["nephrology follow-up", "renal follow-up", "nephrologist"] },
    ],
  },
  {
    id: "musculoskeletal",
    title: "Musculoskeletal",
    shortLabel: "Joints and muscles",
    bodyRegions: ["joints", "muscles"],
    description: "Joint and muscle symptoms, examination findings, function, and related follow-up.",
    evidenceKeywords: ["joint", "arthritis", "arthralgia", "muscle", "myalgia", "stiffness", "musculoskeletal"],
    checklist: [
      { id: "joint-exam", label: "Joint examination reviewed", evidenceKeywords: ["joint examination", "joint exam"] },
      { id: "tender-joints", label: "Tender joint count reviewed", evidenceKeywords: ["tender joint"] },
      { id: "swollen-joints", label: "Swollen joint count reviewed", evidenceKeywords: ["swollen joint"] },
      { id: "morning-stiffness", label: "Morning stiffness duration reviewed", evidenceKeywords: ["morning stiffness"] },
    ],
  },
  {
    id: "mucocutaneous",
    title: "Mucocutaneous",
    shortLabel: "Skin and mouth",
    bodyRegions: ["skin", "oral-cavity"],
    description: "Skin, hair, oral, and vascular findings documented for clinician review.",
    evidenceKeywords: ["rash", "skin", "cutaneous", "oral ulcer", "mouth ulcer", "photosensitivity", "alopecia", "vasculitis", "mucosal"],
    checklist: [
      { id: "rash", label: "Rash reviewed", evidenceKeywords: ["rash", "cutaneous"] },
      { id: "oral-ulcers", label: "Oral ulcers reviewed", evidenceKeywords: ["oral ulcer", "mouth ulcer"] },
      { id: "photosensitivity", label: "Photosensitivity reviewed", evidenceKeywords: ["photosensitivity", "sun sensitivity"] },
      { id: "alopecia", label: "Hair loss reviewed", evidenceKeywords: ["alopecia", "hair loss"] },
      { id: "vasculitis", label: "Cutaneous vasculitis reviewed", evidenceKeywords: ["cutaneous vasculitis", "skin vasculitis"] },
    ],
  },
  {
    id: "neuropsychiatric",
    title: "Neuropsychiatric",
    shortLabel: "Brain and nerves",
    bodyRegions: ["brain"],
    description: "Neurologic and psychiatric findings documented in the record without inferring causation.",
    evidenceKeywords: ["seizure", "neurolog", "neuropathy", "psychosis", "cognitive", "confusion", "brain", "nervous system"],
    checklist: [
      { id: "neurologic-symptoms", label: "Neurologic symptoms reviewed", evidenceKeywords: ["neurologic symptom", "neuropathy", "weakness", "numbness"] },
      { id: "seizures", label: "Seizure history reviewed", evidenceKeywords: ["seizure"] },
      { id: "cognition", label: "Cognition reviewed", evidenceKeywords: ["cognitive", "confusion", "memory"] },
      { id: "mood-behavior", label: "Mood and behavior reviewed", evidenceKeywords: ["mood", "behavior", "psychosis"] },
    ],
  },
  {
    id: "cardiorespiratory",
    title: "Cardiorespiratory",
    shortLabel: "Heart and lungs",
    bodyRegions: ["heart", "lungs"],
    description: "Heart, lung, chest symptom, imaging, and specialty follow-up evidence.",
    evidenceKeywords: ["heart", "cardiac", "pericard", "myocard", "lung", "pulmonary", "pleur", "chest pain", "dyspnea", "shortness of breath"],
    checklist: [
      { id: "chest-symptoms", label: "Chest symptoms reviewed", evidenceKeywords: ["chest pain", "pleuritic"] },
      { id: "breathing", label: "Breathing symptoms reviewed", evidenceKeywords: ["dyspnea", "shortness of breath", "breathing"] },
      { id: "cardiac", label: "Cardiac findings reviewed", evidenceKeywords: ["cardiac", "heart", "pericard", "myocard"] },
      { id: "pulmonary", label: "Pulmonary findings reviewed", evidenceKeywords: ["pulmonary", "lung", "pleur"] },
    ],
  },
  {
    id: "hematologic",
    title: "Hematologic",
    shortLabel: "Blood",
    bodyRegions: ["blood"],
    description: "Blood counts, clotting findings, adverse events, and hematology follow-up.",
    evidenceKeywords: ["hematolog", "blood count", "cbc", "hemoglobin", "anemia", "white blood", "leukopen", "platelet", "thrombocyt", "clot", "thrombo"],
    checklist: [
      { id: "hemoglobin", label: "Hemoglobin reviewed", evidenceKeywords: ["hemoglobin", "anemia"] },
      { id: "white-blood-cells", label: "White blood cells reviewed", evidenceKeywords: ["white blood", "wbc", "leukopen"] },
      { id: "platelets", label: "Platelets reviewed", evidenceKeywords: ["platelet", "thrombocyt"] },
      { id: "clotting", label: "Clotting history reviewed", evidenceKeywords: ["clot", "thrombo", "antiphospholipid"] },
    ],
  },
  {
    id: "gastrointestinal",
    title: "Gastrointestinal",
    shortLabel: "GI tract",
    bodyRegions: ["gi-tract"],
    description: "Gastrointestinal symptoms, liver findings, procedures, and nutrition-related follow-up.",
    evidenceKeywords: ["gastrointestinal", "abdominal", "nausea", "vomiting", "bowel", "liver", "hepatic", "pancrea", "enteritis"],
    checklist: [
      { id: "abdominal-symptoms", label: "Abdominal symptoms reviewed", evidenceKeywords: ["abdominal", "nausea", "vomiting"] },
      { id: "bowel-symptoms", label: "Bowel symptoms reviewed", evidenceKeywords: ["bowel", "diarrhea", "constipation"] },
      { id: "liver", label: "Liver findings reviewed", evidenceKeywords: ["liver", "hepatic"] },
      { id: "nutrition", label: "Nutrition impact reviewed", evidenceKeywords: ["nutrition", "dietitian", "weight loss"] },
    ],
  },
  {
    id: "ophthalmic",
    title: "Ophthalmic",
    shortLabel: "Eyes",
    bodyRegions: ["eyes"],
    description: "Eye symptoms, ophthalmology findings, and medication-related screening follow-up.",
    evidenceKeywords: ["eye", "vision", "ophthalm", "retina", "visual field", "hydroxychloroquine screening", "retinopathy"],
    checklist: [
      { id: "eye-symptoms", label: "Eye symptoms reviewed", evidenceKeywords: ["eye symptom", "vision change", "visual symptom"] },
      { id: "retinal-screening", label: "Retinal screening reviewed", evidenceKeywords: ["retinal screening", "retinopathy screening", "hydroxychloroquine screening"] },
      { id: "ophthalmology-follow-up", label: "Ophthalmology follow-up reviewed", evidenceKeywords: ["ophthalmology follow-up", "ophthalmologist"] },
      { id: "visual-field", label: "Visual-field testing reviewed", evidenceKeywords: ["visual field"] },
    ],
  },
];

export const SLE_SYSTEM_BY_ID = Object.fromEntries(SLE_SYSTEM_DEFINITIONS.map(system => [system.id, system])) as Record<SleSystemId, SleSystemDefinition>;

export function isSleSystemId(value: unknown): value is SleSystemId {
  return typeof value === "string" && value in SLE_SYSTEM_BY_ID;
}

