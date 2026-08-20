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
  publishWeeklyBatch,
  saveBatchInventory,
} from "@/db/batches.server";
import {
  createAdminCustomer,
  getAdminDashboardOverview,
  getBatchMealDemand,
  listAdminCustomers,
  listAdminMemberships,
  listAdminPlanCategories,
  updateAdminCustomer,
} from "@/db/customers.server";
import {
  createAdminMenuItem,
  listAdminMenuItems,
  listAdminPlanCategoriesWithId,
  updateAdminMenuItem,
} from "@/db/catalog.server";
import { membershipStatuses } from "@/db/schema/memberships";
import { portionDefaults } from "@/db/schema/customer-profiles";
import { paymentSchedules } from "@/db/schema/payment-schedules";

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

export const fetchAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .handler(async () => getAdminDashboardOverview());

export const fetchAdminCustomers = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .handler(async () => listAdminCustomers());

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

const createCustomerSchema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().max(255).optional(),
  paymentSchedule: z.enum(paymentSchedules).optional(),
  portionDefault: z.enum(portionDefaults).optional(),
  defaultPickupWindowId: z.string().uuid().optional(),
  planSlug: z.string().trim().max(64).optional(),
  mealsPerWeek: z.number().int().min(1).max(56).optional(),
  chefNotes: z.string().trim().max(2000).optional(),
  activateMembership: z.boolean().optional(),
});

export const createAdminCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(createCustomerSchema)
  .handler(async ({ data }) => {
    const userId = await createAdminCustomer(data);
    return { userId };
  });

const updateCustomerSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().max(255).optional(),
  paymentSchedule: z.enum(paymentSchedules).optional(),
  portionDefault: z.enum(portionDefaults).optional(),
  defaultPickupWindowId: z.string().uuid().nullable().optional(),
  planSlug: z.string().trim().max(64).nullable().optional(),
  mealsPerWeek: z.number().int().min(1).max(56).nullable().optional(),
  chefNotes: z.string().trim().max(2000).nullable().optional(),
  membershipStatus: z.enum(membershipStatuses).optional(),
});

export const updateAdminCustomerProfile = createServerFn({ method: "POST" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(updateCustomerSchema)
  .handler(async ({ data }) => {
    await updateAdminCustomer(data);
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
