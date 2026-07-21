export type PortionSize = "4oz" | "6oz";

export interface CategoryMeal {
  id: string;
  name: string;
  note?: string;
}

export interface PlanCategory {
  id: string;
  name: string;
  tagline: string;
  description: string;
  recommendedFor: string;
  tags: string[];
  meals: CategoryMeal[];
  price4oz: number;
  price6oz: number;
  accent: "gold" | "green" | "orange" | "pink" | "navy";
}

export interface IngredientItem {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface PickupWindow {
  id: string;
  label: string;
  day: string;
  time: string;
}

export type OrderStatus =
  | "received"
  | "preparing"
  | "ready"
  | "picked-up";

export interface OrderLine {
  categoryId: string;
  portion: PortionSize;
  quantity: number;
}

export interface OrderIngredientLine {
  ingredientId: string;
  quantity: number;
}

export interface PastOrder {
  id: string;
  placedAt: string;
  pickupLabel: string;
  status: OrderStatus;
  lines: OrderLine[];
  extras: OrderIngredientLine[];
  total: number;
  feedbackLeft?: boolean;
}

export const planCategories: PlanCategory[] = [
  {
    id: "high-protein",
    name: "High Protein",
    tagline: "Fuel strong days",
    description:
      "Lean protein-forward meals to support muscle, recovery, and fitness goals. Simple, satisfying, and never bland.",
    recommendedFor: "Great for gym days, active adults, and anyone building strength.",
    tags: ["Protein", "Fitness", "Low sugar"],
    price4oz: 9.5,
    price6oz: 12.5,
    accent: "orange",
    meals: [
      { id: "gt-spag", name: "Ground Turkey Spaghetti" },
      { id: "roast-chick", name: "Roasted Chicken Dinner" },
      { id: "greek-chick", name: "Roasted Greek Chicken Dinner" },
      { id: "chick-parm", name: "Chicken Parmesan" },
      { id: "lemon-pepper", name: "Lemon Pepper Chicken" },
      { id: "jerk-chick", name: "Jerk Chicken" },
    ],
  },
  {
    id: "breakfast-parfaits",
    name: "Breakfast Parfaits",
    tagline: "Easy mornings",
    description:
      "Layered yogurt parfaits and warm egg bites for a gentle, ready-to-go start to the day.",
    recommendedFor: "Perfect for busy mornings or a light, protein-rich breakfast.",
    tags: ["Breakfast", "Light", "Yogurt"],
    price4oz: 6.5,
    price6oz: 8.5,
    accent: "pink",
    meals: [
      { id: "parfait", name: "Breakfast Parfaits" },
      { id: "egg-bites", name: "Egg Bites" },
    ],
  },
  {
    id: "low-sodium",
    name: "Low Sodium",
    tagline: "Gentle & heart-kind",
    description:
      "Full-flavor meals seasoned with herbs and citrus instead of salt. Kind on the heart, still comforting.",
    recommendedFor: "Recommended for heart-healthy eating and low-sodium diets.",
    tags: ["Low sodium", "Heart-kind"],
    price4oz: 9.0,
    price6oz: 12.0,
    accent: "green",
    meals: [
      { id: "lemon-pepper-ls", name: "Lemon Pepper Chicken" },
      { id: "roast-chick-ls", name: "Roasted Chicken Dinner" },
      { id: "green-beans-ls", name: "Fresh Seasoned Green Beans" },
      { id: "basmati-ls", name: "Basmati Rice" },
    ],
  },
  {
    id: "senior-size",
    name: "Senior Size Servings",
    tagline: "Just-right portions",
    description:
      "Comforting classics in smaller, easy-to-finish portions. Simple to heat, simple to enjoy.",
    recommendedFor: "Made with older adults in mind — approachable flavors, easy portions.",
    tags: ["Senior-friendly", "Comfort"],
    price4oz: 8.5,
    price6oz: 11.0,
    accent: "gold",
    meals: [
      { id: "roast-chick-sr", name: "Roasted Chicken Dinner" },
      { id: "gt-spag-sr", name: "Ground Turkey Spaghetti" },
      { id: "chick-chili", name: "Chicken Chili with Honey Cornbread" },
      { id: "green-beans-sr", name: "Fresh Seasoned Green Beans" },
    ],
  },
  {
    id: "balanced",
    name: "Good Balanced Meals",
    tagline: "A little of everything",
    description:
      "Well-rounded plates with a protein, a starch, and a vegetable. The Chef Margaux classic.",
    recommendedFor: "A great everyday plan for the whole family.",
    tags: ["Family", "Balanced", "Everyday"],
    price4oz: 9.0,
    price6oz: 12.0,
    accent: "navy",
    meals: [
      { id: "chick-parm-b", name: "Chicken Parmesan" },
      { id: "greek-chick-b", name: "Roasted Greek Chicken Dinner" },
      { id: "gt-spag-b", name: "Ground Turkey Spaghetti" },
      { id: "chick-chili-b", name: "Chicken Chili with Honey Cornbread" },
    ],
  },
  {
    id: "veggie",
    name: "Veggie Meals",
    tagline: "Garden-forward",
    description:
      "Hearty meatless meals with real vegetables at the center. Never an afterthought.",
    recommendedFor: "For meatless days or anyone who loves vegetables.",
    tags: ["Vegetarian", "Veggie"],
    price4oz: 8.5,
    price6oz: 11.0,
    accent: "green",
    meals: [
      { id: "eggplant-parm", name: "Eggplant Parmesan" },
      { id: "veggie-pizza", name: "Crustless Veggie Supreme Pizza" },
      { id: "green-beans-v", name: "Fresh Seasoned Green Beans" },
    ],
  },
  {
    id: "diy",
    name: "DIY Meal Prep Ingredients",
    tagline: "Build your own",
    description:
      "Cooked proteins, grains, and sides by the container — mix and match your week.",
    recommendedFor: "Best for meal preppers who like to build their own bowls.",
    tags: ["Meal prep", "Build-your-own"],
    price4oz: 6.0,
    price6oz: 8.0,
    accent: "gold",
    meals: [
      { id: "shredded-chick", name: "Shredded Chicken" },
      { id: "basmati", name: "Basmati Rice" },
      { id: "black-beans", name: "Black Beans" },
      { id: "green-beans", name: "Fresh Seasoned Green Beans" },
    ],
  },
];

export const ingredientItems: IngredientItem[] = [
  { id: "ing-shredded-chick", name: "Shredded Chicken", description: "Seasoned & pulled", price: 7.5 },
  { id: "ing-green-beans", name: "Fresh Seasoned Green Beans", description: "Buttery & bright", price: 5.0 },
  { id: "ing-basmati", name: "Basmati Rice", description: "Fluffy long grain", price: 4.5 },
  { id: "ing-black-beans", name: "Black Beans", description: "Slow-simmered", price: 4.5 },
  { id: "ing-veg-salad", name: "Veggie Side Salad", description: "Crisp & fresh", price: 6.0 },
];

export const pickupWindows: PickupWindow[] = [
  { id: "tue-pm", label: "Tuesday 3:00 PM – 5:00 PM", day: "Tuesday", time: "3:00 PM – 5:00 PM" },
  { id: "wed-pm", label: "Wednesday 3:00 PM – 5:00 PM", day: "Wednesday", time: "3:00 PM – 5:00 PM" },
  { id: "fri-am", label: "Friday 11:00 AM – 1:00 PM", day: "Friday", time: "11:00 AM – 1:00 PM" },
];

export const seedPastOrders: PastOrder[] = [
  {
    id: "TG-1042",
    placedAt: "2 weeks ago",
    pickupLabel: "Friday 11:00 AM – 1:00 PM",
    status: "picked-up",
    lines: [
      { categoryId: "senior-size", portion: "4oz", quantity: 4 },
      { categoryId: "balanced", portion: "6oz", quantity: 2 },
    ],
    extras: [{ ingredientId: "ing-green-beans", quantity: 1 }],
    total: 68.5,
  },
  {
    id: "TG-1031",
    placedAt: "Last month",
    pickupLabel: "Wednesday 3:00 PM – 5:00 PM",
    status: "picked-up",
    lines: [{ categoryId: "high-protein", portion: "6oz", quantity: 5 }],
    extras: [],
    total: 62.5,
    feedbackLeft: true,
  },
];

export const wizardGoals = [
  "Build muscle",
  "Eat lower sodium",
  "Easy breakfasts",
  "Senior-friendly portions",
  "Weight management",
  "Family meals",
];

export function categoryPrice(cat: PlanCategory, portion: PortionSize) {
  return portion === "4oz" ? cat.price4oz : cat.price6oz;
}

export function getCategory(id: string) {
  return planCategories.find((c) => c.id === id);
}

export function getIngredient(id: string) {
  return ingredientItems.find((i) => i.id === id);
}

export function recommendFromGoals(goals: string[]): PlanCategory[] {
  const g = goals.map((s) => s.toLowerCase()).join(" ");
  const picks: string[] = [];
  if (/muscle|protein|gym|fit/.test(g)) picks.push("high-protein");
  if (/sodium|heart|blood pressure/.test(g)) picks.push("low-sodium");
  if (/breakfast|morning/.test(g)) picks.push("breakfast-parfaits");
  if (/senior|older|parent|mom|dad|small/.test(g)) picks.push("senior-size");
  if (/weight|light|lean|calorie/.test(g)) picks.push("balanced");
  if (/family|kids|everyone/.test(g)) picks.push("balanced");
  if (/veg|plant|meatless/.test(g)) picks.push("veggie");
  if (/prep|diy|build/.test(g)) picks.push("diy");
  const unique = Array.from(new Set(picks)).slice(0, 3);
  const list = unique.map((id) => getCategory(id)!).filter(Boolean);
  if (list.length === 0)
    return [getCategory("balanced")!, getCategory("senior-size")!, getCategory("high-protein")!];
  return list;
}
