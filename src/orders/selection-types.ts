import type { Portion } from "@/db/schema/order-lines.ts";
import type { OrderStatus } from "@/db/schema/weekly-orders.ts";
import type { PaymentSchedule } from "@/db/schema/payment-schedules.ts";

export const SELECTABLE_ORDER_STATUSES = ["awaiting_selection", "selection_in_progress"] as const;
export type SelectableOrderStatus = (typeof SELECTABLE_ORDER_STATUSES)[number];

export type SelectionPick = {
  menuItemId: string;
  qty: number;
};

export type SelectionMenuMeal = {
  batchItemId: string;
  menuItemId: string;
  menuItemName: string;
  menuItemNote: string | null;
  unitPriceCents: number;
};

export type SelectionOrderLine = {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemNote: string | null;
  portion: Portion;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type WeeklyOrderSelection = {
  order: {
    id: string;
    status: OrderStatus;
    subtotalCents: number;
    taxCents: number;
    tipCents: number;
    totalCents: number;
    mealsAllowed: number;
    mealsSelected: number;
    portion: Portion;
    membershipId: string | null;
    planSlug: string | null;
    planName: string | null;
    paymentScheduleSnapshot: PaymentSchedule | null;
    selectionSubmittedAt: string | null;
  };
  batch: {
    id: string;
    weekStart: string;
    pickupDate: string | null;
    selectionDeadline: string | null;
    status: string;
  };
  pickupWindow: {
    id: string;
    label: string;
    dayOfWeek: string;
    timeRange: string;
    locationName: string | null;
  } | null;
  menuMeals: SelectionMenuMeal[];
  lines: SelectionOrderLine[];
  canEdit: boolean;
  canSubmit: boolean;
  editBlockedReason: string | null;
};

export function isSelectableOrderStatus(status: OrderStatus): status is SelectableOrderStatus {
  return (SELECTABLE_ORDER_STATUSES as readonly string[]).includes(status);
}

export function resolveSelectionSaveStatus(status: OrderStatus): OrderStatus {
  return status === "awaiting_selection" ? "selection_in_progress" : status;
}

export function resolveSelectionSubmitStatus(): OrderStatus {
  return "selection_submitted";
}

export function isBeforeSelectionDeadline(
  selectionDeadline: Date | null,
  now = new Date(),
): boolean {
  if (!selectionDeadline) return true;
  return now.getTime() < selectionDeadline.getTime();
}

export function sumSelectionQty(picks: ReadonlyArray<{ qty: number }>): number {
  return picks.reduce((sum, pick) => sum + pick.qty, 0);
}

export function getOrderSelectionState(input: {
  orderStatus: OrderStatus;
  batchStatus: string;
  selectionDeadline: Date | null;
  mealsAllowed: number | null;
  now?: Date;
}): {
  canEdit: boolean;
  canSubmit: boolean;
  editBlockedReason: string | null;
} {
  const now = input.now ?? new Date();

  if (input.orderStatus === "selection_submitted") {
    return {
      canEdit: false,
      canSubmit: false,
      editBlockedReason: "Your meal selection has already been submitted.",
    };
  }

  if (!isSelectableOrderStatus(input.orderStatus)) {
    return {
      canEdit: false,
      canSubmit: false,
      editBlockedReason: "This order is not open for meal selection.",
    };
  }

  if (input.batchStatus !== "selection_open") {
    return {
      canEdit: false,
      canSubmit: false,
      editBlockedReason: "Meal selection is closed for this week.",
    };
  }

  if (!isBeforeSelectionDeadline(input.selectionDeadline, now)) {
    return {
      canEdit: false,
      canSubmit: false,
      editBlockedReason: "The selection deadline has passed.",
    };
  }

  if (input.mealsAllowed == null || input.mealsAllowed <= 0) {
    return {
      canEdit: false,
      canSubmit: false,
      editBlockedReason: "Meal allowance is not available for this order.",
    };
  }

  return { canEdit: true, canSubmit: true, editBlockedReason: null };
}

/** Validate picks for save (partial) — qty bounds and batch menu membership only. */
export function validateSelectionSavePicks(
  picks: ReadonlyArray<SelectionPick>,
  mealsAllowed: number,
  batchMenuItemIds: ReadonlySet<string>,
): void {
  if (mealsAllowed <= 0) {
    throw new Error("Meal allowance is not available for this order.");
  }

  let runningTotal = 0;
  const seenMenuItems = new Set<string>();

  for (const pick of picks) {
    if (pick.qty < 0) {
      throw new Error("Quantity cannot be negative.");
    }
    if (pick.qty === 0) {
      continue;
    }
    if (!batchMenuItemIds.has(pick.menuItemId)) {
      throw new Error("One or more selected meals are not on this week's menu.");
    }
    if (seenMenuItems.has(pick.menuItemId)) {
      throw new Error("Duplicate meal selections are not allowed.");
    }
    seenMenuItems.add(pick.menuItemId);
    runningTotal += pick.qty;
    if (runningTotal > mealsAllowed) {
      throw new Error(`You can select up to ${mealsAllowed} meal${mealsAllowed === 1 ? "" : "s"}.`);
    }
  }
}

/** Validate picks for submit — must exactly match meals_allowed snapshot. */
export function validateSelectionSubmitPicks(
  picks: ReadonlyArray<SelectionPick>,
  mealsAllowed: number,
  batchMenuItemIds: ReadonlySet<string>,
): void {
  validateSelectionSavePicks(picks, mealsAllowed, batchMenuItemIds);

  const total = sumSelectionQty(picks.filter((p) => p.qty > 0));
  if (total !== mealsAllowed) {
    throw new Error(
      `Select exactly ${mealsAllowed} meal${mealsAllowed === 1 ? "" : "s"} before submitting (${total} selected).`,
    );
  }
}
