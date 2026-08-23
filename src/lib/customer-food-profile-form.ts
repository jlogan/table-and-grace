import type { PortionDefault } from "@/db/schema/customer-profiles";
import type { AdminCustomerDetail } from "@/orders/admin-types";
import type { DietaryPreferenceSlug, FoodAllergenSlug } from "@/lib/food-profile";

export type FoodProfileFormState = {
  portionDefault: PortionDefault;
  dietaryPreferences: DietaryPreferenceSlug[];
  dietaryPreferenceOther: string;
  foodAllergens: FoodAllergenSlug[];
  foodAllergenOther: string;
  chefNotes: string;
};

export function foodProfileFormStateFromCustomer(
  customer: AdminCustomerDetail,
): FoodProfileFormState {
  return {
    portionDefault: customer.portionDefault,
    dietaryPreferences: [...customer.dietaryPreferences],
    dietaryPreferenceOther: customer.dietaryPreferenceOther ?? "",
    foodAllergens: [...customer.foodAllergens],
    foodAllergenOther: customer.foodAllergenOther ?? "",
    chefNotes: customer.chefNotes ?? "",
  };
}

export function hasPreviousFoodInformation(customer: AdminCustomerDetail): boolean {
  return customer.dietaryTags.length > 0 || Boolean(customer.allergies?.trim());
}
