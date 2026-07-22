import type { NutritionGuidance } from "../types.js";
import { GENERAL_NUTRITION_CONTENT, INSUFFICIENT_NUTRITION_MESSAGE } from "./nutrition-content.js";
import type { NutritionContext } from "./normalize-nutrition-context.js";

function observationReference(observation: fhir4.Observation | undefined): string[] {
  return observation?.id ? [`Observation/${observation.id}`] : [];
}

function approvedOrderGuidance(order: fhir4.NutritionOrder): NutritionGuidance | null {
  const instruction = order.oralDiet?.instruction?.[0] ?? order.enteralFormula?.administrationInstruction;
  if (!instruction) return null;
  return {
    id: `nutrition-order-${order.id ?? "active"}`,
    category: "other",
    title: "Care-team nutrition instruction",
    recommendation: instruction,
    whyItMayMatter: "This instruction comes from an active nutrition order in your medical record.",
    status: "clinician-approved",
    statusLabel: "Approved by your care team",
    supportingReferences: order.id ? [`NutritionOrder/${order.id}`] : [],
    safetyNote: "Follow the written instruction and ask your care team if anything is unclear.",
  };
}

export function buildNutritionGuidance(context: NutritionContext): NutritionGuidance[] {
  const guidance: NutritionGuidance[] = [
    {
      id: "general-sodium-education",
      category: "sodium",
      title: GENERAL_NUTRITION_CONTENT.sodium.title,
      recommendation: GENERAL_NUTRITION_CONTENT.sodium.recommendation,
      whyItMayMatter: GENERAL_NUTRITION_CONTENT.sodium.whyItMayMatter,
      status: "general-education",
      statusLabel: "General education",
      supportingReferences: [],
      safetyNote: "This is general education, not a prescribed sodium limit.",
    },
    {
      id: "general-balanced-meals",
      category: "balanced-meals",
      title: GENERAL_NUTRITION_CONTENT.balancedMeals.title,
      recommendation: GENERAL_NUTRITION_CONTENT.balancedMeals.recommendation,
      whyItMayMatter: GENERAL_NUTRITION_CONTENT.balancedMeals.whyItMayMatter,
      status: "general-education",
      statusLabel: "General education",
      supportingReferences: [],
    },
  ];

  for (const order of context.nutritionOrders) {
    const item = approvedOrderGuidance(order);
    if (item) guidance.push(item);
  }

  if (context.renalDiseaseDocumented) {
    guidance.push(
      {
        id: "protein-discussion",
        category: "protein",
        title: "Protein",
        recommendation: INSUFFICIENT_NUTRITION_MESSAGE,
        whyItMayMatter: "Protein needs depend on kidney function, treatment phase, nutrition status, and whether dialysis is part of the care plan.",
        status: "suggested-for-discussion",
        statusLabel: "Suggested for discussion",
        supportingReferences: [],
        safetyNote: "The portal does not calculate or prescribe a protein target.",
      },
      {
        id: "potassium-review",
        category: "potassium",
        title: "Potassium",
        recommendation: INSUFFICIENT_NUTRITION_MESSAGE,
        whyItMayMatter: "Potassium guidance depends on current laboratory results, medicines, and the care-team plan.",
        status: context.latestPotassium ? "waiting-for-review" : "suggested-for-discussion",
        statusLabel: context.latestPotassium ? "Waiting for review" : "Not enough information",
        supportingReferences: observationReference(context.latestPotassium),
        safetyNote: "No potassium restriction is generated automatically.",
      },
      {
        id: "phosphorus-review",
        category: "phosphorus",
        title: "Phosphorus",
        recommendation: INSUFFICIENT_NUTRITION_MESSAGE,
        whyItMayMatter: "Phosphorus advice requires current results and individualized kidney-disease planning.",
        status: context.latestPhosphorus ? "waiting-for-review" : "suggested-for-discussion",
        statusLabel: context.latestPhosphorus ? "Waiting for review" : "Not enough information",
        supportingReferences: observationReference(context.latestPhosphorus),
        safetyNote: "No phosphorus restriction is generated automatically.",
      },
      {
        id: "fluid-review",
        category: "fluids",
        title: "Fluids",
        recommendation: INSUFFICIENT_NUTRITION_MESSAGE,
        whyItMayMatter: "Fluid needs vary with kidney function, swelling, blood pressure, medicines, and treatment.",
        status: "suggested-for-discussion",
        statusLabel: "Not enough information",
        supportingReferences: [],
        safetyNote: "No fluid restriction is generated automatically.",
      },
    );
  }

  return guidance;
}

