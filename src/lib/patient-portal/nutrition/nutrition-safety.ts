import type { NutritionContext } from "./normalize-nutrition-context.js";

const RESTRICTION_TERMS = ["restrict", "avoid", "low potassium", "low phosphorus", "low protein", "high protein", "fluid limit", "supplement"];

export function hasClinicianApprovedNutritionOrder(context: NutritionContext): boolean {
  return context.nutritionOrders.some(order => order.status === "active" && order.intent === "order");
}

export function isSafeAutomatedNutritionGuidance(text: string, context: NutritionContext): boolean {
  if (hasClinicianApprovedNutritionOrder(context)) return true;
  const normalized = text.toLowerCase();
  return !RESTRICTION_TERMS.some(term => normalized.includes(term));
}

