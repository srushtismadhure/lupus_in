export const GENERAL_NUTRITION_CONTENT = {
  sodium: {
    title: "Salt and sodium",
    recommendation: "Choose mostly fresh or minimally processed foods when that fits your care plan. Compare labels because packaged foods can contain different amounts of sodium.",
    whyItMayMatter: "Sodium can affect blood pressure and fluid balance, but your individual goal should come from your care team or dietitian.",
  },
  balancedMeals: {
    title: "Balanced meals",
    recommendation: "Build regular meals from foods you tolerate and enjoy, using the nutrition plan your care team has approved.",
    whyItMayMatter: "Regular, balanced meals can support energy and make it easier to take medicines as directed.",
  },
} as const;

export const INSUFFICIENT_NUTRITION_MESSAGE =
  "We do not have enough information to recommend changing this part of your diet. Ask your care team or dietitian before making a major change.";

export const CURATED_MEAL_IDEAS = [
  { id: "oats-fruit", title: "Oatmeal with berries", tags: ["general", "vegetarian"], allergens: [] },
  { id: "grain-veg-bowl", title: "Grain and roasted vegetable bowl", tags: ["general", "vegetarian"], allergens: [] },
  { id: "chicken-salad", title: "Herb chicken with a simple side salad", tags: ["general"], allergens: [] },
] as const;

