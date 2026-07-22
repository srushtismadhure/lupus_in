import { CURATED_MEAL_IDEAS } from "./nutrition-content.js";

export function filterMealTemplates(allergies: string[], preferences: string[] = []): Array<{ id: string; title: string }> {
  const allergyTerms = allergies.map(item => item.toLowerCase());
  const preferenceTerms = preferences.map(item => item.toLowerCase());
  return CURATED_MEAL_IDEAS.filter(template => {
    if (template.allergens.some(allergen => allergyTerms.some(item => item.includes(allergen)))) return false;
    if (preferenceTerms.includes("vegetarian") && !(template.tags as readonly string[]).includes("vegetarian")) return false;
    return true;
  }).map(template => ({ id: template.id, title: template.title }));
}
