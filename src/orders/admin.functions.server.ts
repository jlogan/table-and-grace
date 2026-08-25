import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireRoleMiddleware } from "@/auth/middleware.server";
import {
  createWeeklyBatch,
  getBatchInventory,
  listActiveMenuItemsForAdmin,
  listAdminBatches,
  listAdminOrders,
  listAdminPickupWindows,
  openMenuForSelection,
  publishWeeklyBatch,
  saveBatchInventory,
} from "@/db/batches.server";
import {
  createAdminCustomer,
  createAdminMembership,
  getAdminCustomerDetail,
  getAdminDashboardOverview,
  getBatchMealDemand,
  listAdminCustomers,
  listAdminMemberships,
  listAdminPlanCategories,
  updateAdminCustomer,
  updateAdminMembership,
} from "@/db/customers.server";
import {
  createAdminMenuItem,
  listAdminMenuItems,
  listAdminPlanCategoriesWithId,
  updateAdminMenuItem,
} from "@/db/catalog.server";
import { billingProfiles, membershipStatuses } from "@/db/schema/memberships";
import { portionDefaults } from "@/db/schema/customer-profiles";
import { paymentSchedules } from "@/db/schema/payment-schedules";
import { dietaryPreferenceSlugs, foodAllergenSlugs } from "@/lib/food-profile";

const batchIdSchema = z.object({
  batchId: z.string().uuid(),
});

const optionalBatchFilterSchema = z.object({
  batchId: z.string().uuid().optional(),
});

const createBatchSchema = z.object({
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  pickupWindowId: z.string().uuid().optional(),
});

const saveInventorySchema = z.object({
  batchId: z.string().uuid(),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      qtyCooked: z.number().int().min(0).max(999),
    }),
  ),
});

export const fetchAdminBatches = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .handler(async () => listAdminBatches());

export const fetchAdminPickupWindows = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .handler(async () => listAdminPickupWindows());

export const fetchActiveMenuItemsForAdmin = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .handler(async () => listActiveMenuItemsForAdmin());

export const fetchBatchInventory = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(batchIdSchema)
  .handler(async ({ data }) => getBatchInventory(data.batchId));

export const fetchAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(optionalBatchFilterSchema)
  .handler(async ({ data }) => listAdminOrders(data.batchId));

export const createAdminWeeklyBatch = createServerFn({ method: "POST" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(createBatchSchema)
  .handler(async ({ data }) => {
    const batchId = await createWeeklyBatch(data);
    return { batchId };
  });

export const saveAdminBatchInventory = createServerFn({ method: "POST" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(saveInventorySchema)
  .handler(async ({ data }) => {
    await saveBatchInventory(data);
    return getBatchInventory(data.batchId);
  });

export const publishAdminWeeklyBatch = createServerFn({ method: "POST" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(batchIdSchema)
  .handler(async ({ data }) => publishWeeklyBatch(data.batchId));

const openMenuForSelectionSchema = z.object({
  batchId: z.string().uuid(),
  selectionDeadline: z.string().datetime(),
});

export const openAdminMenuForSelection = createServerFn({ method: "POST" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(openMenuForSelectionSchema)
  .handler(async ({ data }) => {
    return openMenuForSelection(data.batchId, {
      selectionDeadline: new Date(data.selectionDeadline),
    });
  });

export const fetchAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .handler(async () => getAdminDashboardOverview());

export const fetchAdminCustomers = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .handler(async () => listAdminCustomers());

const customerIdSchema = z.object({
  userId: z.string().uuid(),
});

export const fetchAdminCustomerDetail = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(customerIdSchema)
  .handler(async ({ data }) => {
    const customer = await getAdminCustomerDetail(data.userId);
    if (!customer) {
      throw new Error("Customer not found.");
    }
    return customer;
  });

export const fetchAdminMemberships = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .handler(async () => listAdminMemberships());

export const fetchAdminPlanCategories = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .handler(async () => listAdminPlanCategories());

export const fetchBatchMealDemand = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(batchIdSchema)
  .handler(async ({ data }) => getBatchMealDemand(data.batchId));

const dietaryTagsSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(20)
  .refine((tags) => !tags.some((t) => /^(plan|meals):/i.test(t)), {
    message: 'Dietary tags cannot use reserved "plan:" or "meals:" prefixes.',
  });

const dietaryPreferencesSchema = z
  .array(z.enum(dietaryPreferenceSlugs))
  .max(dietaryPreferenceSlugs.length)
  .optional();

const foodAllergensSchema = z
  .array(z.enum(foodAllergenSlugs))
  .max(foodAllergenSlugs.length)
  .optional();

const createCustomerSchema = z.object({
  email: z.string().trim().email().max(255),
  firstName: z.string().trim().min(1).max(127),
  lastName: z.string().trim().min(1).max(127),
  preferredName: z.string().trim().max(127).optional(),
  name: z.string().trim().max(255).optional(),
  phone: z.string().trim().max(32).optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  favoriteCake: z.string().trim().max(255).optional(),
  allergies: z.string().trim().max(2000).optional(),
  dietaryTags: dietaryTagsSchema.optional(),
  paymentSchedule: z.enum(paymentSchedules).optional(),
  portionDefault: z.enum(portionDefaults).optional(),
  defaultPickupWindowId: z.string().uuid().optional(),
  planSlug: z.string().trim().max(64).optional(),
  mealsPerWeek: z.number().int().min(1).max(56).optional(),
  chefNotes: z.string().trim().max(4000).optional(),
  activateMembership: z.boolean().optional(),
});

export const createAdminCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(createCustomerSchema)
  .handler(async ({ data }) => {
    const userId = await createAdminCustomer(data);
    return { userId };
  });

const updateCustomerSchema = z
  .object({
    userId: z.string().uuid(),
    email: z.string().trim().email().max(255).optional(),
    firstName: z.string().trim().max(127).optional(),
    lastName: z.string().trim().max(127).optional(),
    preferredName: z.string().trim().max(127).nullable().optional(),
    name: z.string().trim().max(255).optional(),
    phone: z.string().trim().max(32).nullable().optional(),
    birthday: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    favoriteCake: z.string().trim().max(255).nullable().optional(),
    allergies: z.string().trim().max(2000).nullable().optional(),
    dietaryTags: dietaryTagsSchema.optional(),
    dietaryPreferences: dietaryPreferencesSchema.optional(),
    dietaryPreferenceOther: z.string().trim().max(500).nullable().optional(),
    foodAllergens: foodAllergensSchema.optional(),
    foodAllergenOther: z.string().trim().max(500).nullable().optional(),
    paymentSchedule: z.enum(paymentSchedules).optional(),
    portionDefault: z.enum(portionDefaults).optional(),
    defaultPickupWindowId: z.string().uuid().nullable().optional(),
    planSlug: z.string().trim().max(64).nullable().optional(),
    mealsPerWeek: z.number().int().min(1).max(56).nullable().optional(),
    chefNotes: z.string().trim().max(4000).nullable().optional(),
    membershipStatus: z.enum(membershipStatuses).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.dietaryPreferences?.includes("other") &&
      data.dietaryPreferenceOther !== undefined &&
      !data.dietaryPreferenceOther?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Other dietary preference description is required when "Other" is selected.',
        path: ["dietaryPreferenceOther"],
      });
    }

    if (
      data.foodAllergens?.includes("other") &&
      data.foodAllergenOther !== undefined &&
      !data.foodAllergenOther?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Other allergen description is required when "Other" is selected.',
        path: ["foodAllergenOther"],
      });
    }
  });

export const updateAdminCustomerProfile = createServerFn({ method: "POST" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(updateCustomerSchema)
  .handler(async ({ data }) => {
    await updateAdminCustomer(data);
    return { ok: true as const };
  });

const createMembershipSchema = z.object({
  userId: z.string().uuid(),
  planSlug: z.string().trim().max(64).optional(),
  mealsPerWeek: z.number().int().min(1).max(56).optional(),
  portionDefault: z.enum(portionDefaults).optional(),
  paymentSchedule: z.enum(paymentSchedules).optional(),
  billingProfile: z.enum(billingProfiles).optional(),
  fixedPricePerMealCents: z.number().int().min(0).max(999999).optional(),
  discountCents: z.number().int().min(0).max(999999).optional(),
  discountLabel: z.string().trim().max(120).optional(),
  weeklyInvoiceDay: z.number().int().min(0).max(6).optional(),
  monthlyInvoiceDay: z.number().int().min(1).max(28).optional(),
  biweeklyAnchorDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const createAdminMembershipRecord = createServerFn({ method: "POST" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(createMembershipSchema)
  .handler(async ({ data }) => {
    const membershipId = await createAdminMembership(data);
    return { membershipId };
  });

const updateMembershipSchema = z.object({
  membershipId: z.string().uuid(),
  membershipStatus: z.enum(membershipStatuses).optional(),
  pausedUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  planSlug: z.string().trim().max(64).nullable().optional(),
  mealsPerWeek: z.number().int().min(1).max(56).nullable().optional(),
  portionDefault: z.enum(portionDefaults).optional(),
  paymentSchedule: z.enum(paymentSchedules).optional(),
  billingProfile: z.enum(billingProfiles).optional(),
  fixedPricePerMealCents: z.number().int().min(0).max(999999).nullable().optional(),
  discountCents: z.number().int().min(0).max(999999).optional(),
  discountLabel: z.string().trim().max(120).nullable().optional(),
  weeklyInvoiceDay: z.number().int().min(0).max(6).nullable().optional(),
  monthlyInvoiceDay: z.number().int().min(1).max(28).nullable().optional(),
  biweeklyAnchorDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const updateAdminMembershipRecord = createServerFn({ method: "POST" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(updateMembershipSchema)
  .handler(async ({ data }) => {
    await updateAdminMembership(data);
    return { ok: true as const };
  });

export const fetchAdminMenuItems = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .handler(async () => listAdminMenuItems());

export const fetchAdminPlanCategoriesWithId = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .handler(async () => listAdminPlanCategoriesWithId());

const createMenuItemSchema = z.object({
  name: z.string().trim().min(1).max(255),
  note: z.string().trim().max(2000).optional(),
  categoryId: z.string().uuid().optional(),
  price4ozCents: z.number().int().min(0).max(999999).optional(),
  price6ozCents: z.number().int().min(0).max(999999).optional(),
});

export const createAdminMenuItemRecord = createServerFn({ method: "POST" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(createMenuItemSchema)
  .handler(async ({ data }) => {
    const id = await createAdminMenuItem(data);
    return { id };
  });

const updateMenuItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(255).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  price4ozCents: z.number().int().min(0).max(999999).nullable().optional(),
  price6ozCents: z.number().int().min(0).max(999999).nullable().optional(),
});

export const updateAdminMenuItemRecord = createServerFn({ method: "POST" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(updateMenuItemSchema)
  .handler(async ({ data }) => {
    await updateAdminMenuItem(data);
    return { ok: true as const };
  });
