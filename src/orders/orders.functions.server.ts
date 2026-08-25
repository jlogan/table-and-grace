import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware.server";
import {
  approveCustomerOrder,
  getOrderReviewForCustomer,
  getOrderSelectionForCustomer,
  listCustomerOrderSummaries,
  saveCustomerReviewChanges,
  saveCustomerSelection,
  submitCustomerSelection,
} from "@/db/orders.server";

const orderIdSchema = z.object({
  orderId: z.string().uuid(),
});

const saveReviewSchema = z.object({
  orderId: z.string().uuid(),
  lines: z.array(
    z.object({
      lineId: z.string().uuid(),
      qty: z.number().int().min(0).max(99),
    }),
  ),
  substitutions: z.array(
    z.object({
      lineId: z.string().uuid(),
      menuItemId: z.string().uuid(),
      note: z.string().max(500).optional(),
    }),
  ),
  comment: z.string().max(2000).optional(),
});

const selectionPicksSchema = z.object({
  orderId: z.string().uuid(),
  picks: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      qty: z.number().int().min(0).max(99),
    }),
  ),
});

export const fetchCustomerOrderSummaries = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    return listCustomerOrderSummaries(context.user.id);
  });

export const fetchCustomerOrderReview = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .validator(orderIdSchema)
  .handler(async ({ context, data }) => {
    const review = await getOrderReviewForCustomer(data.orderId, context.user.id);
    if (!review) {
      throw new Error("Order not found.");
    }
    return review;
  });

export const fetchCustomerOrderSelection = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .validator(orderIdSchema)
  .handler(async ({ context, data }) => {
    const selection = await getOrderSelectionForCustomer(data.orderId, context.user.id);
    if (!selection) {
      throw new Error("Order not found.");
    }
    return selection;
  });

export const saveWeeklyOrderReview = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(saveReviewSchema)
  .handler(async ({ context, data }) => {
    return saveCustomerReviewChanges({
      orderId: data.orderId,
      userId: context.user.id,
      lines: data.lines,
      substitutions: data.substitutions,
      comment: data.comment,
    });
  });

export const approveWeeklyOrder = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(orderIdSchema)
  .handler(async ({ context, data }) => {
    return approveCustomerOrder(data.orderId, context.user.id);
  });

export const saveWeeklyOrderSelection = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(selectionPicksSchema)
  .handler(async ({ context, data }) => {
    return saveCustomerSelection({
      orderId: data.orderId,
      userId: context.user.id,
      picks: data.picks,
    });
  });

export const submitWeeklyOrderSelection = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(selectionPicksSchema)
  .handler(async ({ context, data }) => {
    return submitCustomerSelection({
      orderId: data.orderId,
      userId: context.user.id,
      picks: data.picks,
    });
  });
