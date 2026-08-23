/** Structured dietary preference slugs for customer food profiles. */
export const dietaryPreferenceOptions = [
  { slug: "high_protein", label: "High Protein" },
  { slug: "low_sodium", label: "Low Sodium" },
  { slug: "low_carb", label: "Low Carb" },
  { slug: "diabetic_friendly", label: "Diabetic Friendly" },
  { slug: "vegetarian", label: "Vegetarian" },
  { slug: "pescatarian", label: "Pescatarian" },
  { slug: "dairy_free", label: "Dairy Free" },
  { slug: "gluten_free", label: "Gluten Free" },
  { slug: "other", label: "Other" },
] as const;

export type DietaryPreferenceSlug = (typeof dietaryPreferenceOptions)[number]["slug"];

export const dietaryPreferenceSlugs = dietaryPreferenceOptions.map((option) => option.slug) as [
  DietaryPreferenceSlug,
  ...DietaryPreferenceSlug[],
];

/** Major food allergen slugs for customer safety profiles. */
export const foodAllergenOptions = [
  { slug: "milk", label: "Milk" },
  { slug: "eggs", label: "Eggs" },
  { slug: "fish", label: "Fish" },
  { slug: "shellfish", label: "Shellfish" },
  { slug: "tree_nuts", label: "Tree Nuts" },
  { slug: "peanuts", label: "Peanuts" },
  { slug: "wheat", label: "Wheat" },
  { slug: "soy", label: "Soy" },
  { slug: "sesame", label: "Sesame" },
  { slug: "other", label: "Other" },
] as const;

export type FoodAllergenSlug = (typeof foodAllergenOptions)[number]["slug"];

export const foodAllergenSlugs = foodAllergenOptions.map((option) => option.slug) as [
  FoodAllergenSlug,
  ...FoodAllergenSlug[],
];

const dietaryPreferenceLabels = new Map<DietaryPreferenceSlug, string>(
  dietaryPreferenceOptions.map((option) => [option.slug, option.label]),
);

const foodAllergenLabels = new Map<FoodAllergenSlug, string>(
  foodAllergenOptions.map((option) => [option.slug, option.label]),
);

export function dietaryPreferenceLabel(slug: DietaryPreferenceSlug): string {
  return dietaryPreferenceLabels.get(slug) ?? slug;
}

export function foodAllergenLabel(slug: FoodAllergenSlug): string {
  return foodAllergenLabels.get(slug) ?? slug;
}
