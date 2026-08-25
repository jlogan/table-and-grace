import type { Portion } from "@/db/schema/order-lines.ts";
import type { PaymentSchedule } from "@/db/schema/payment-schedules.ts";

import { resolveOrderPaymentSchedule } from "./payment-schedule.ts";

export type SelectionOrderSnapshotInput = {
  mealsPerWeek: number;
  portionDefault: Portion;
  planSlug: string | null;
  planName: string | null;
  membershipPaymentSchedule: PaymentSchedule;
  profilePaymentSchedule: PaymentSchedule;
};

/** Entitlement fields frozen when opening selection for a membership-scoped order. */
export function buildSelectionOrderSnapshots(input: SelectionOrderSnapshotInput): {
  mealsAllowedSnapshot: number;
  portionSnapshot: Portion;
  planSlugSnapshot: string | null;
  planNameSnapshot: string | null;
  paymentScheduleSnapshot: PaymentSchedule;
} {
  return {
    mealsAllowedSnapshot: input.mealsPerWeek,
    portionSnapshot: input.portionDefault,
    planSlugSnapshot: input.planSlug,
    planNameSnapshot: input.planName,
    paymentScheduleSnapshot: resolveOrderPaymentSchedule({
      paymentScheduleSnapshot: null,
      membershipPaymentSchedule: input.membershipPaymentSchedule,
      profilePaymentSchedule: input.profilePaymentSchedule,
    }),
  };
}

export function resolveOrderPlanSlug(input: {
  planSlugSnapshot: string | null;
  membershipPlanSlug?: string | null;
}): string | null {
  if (input.planSlugSnapshot) {
    return input.planSlugSnapshot;
  }
  return input.membershipPlanSlug ?? null;
}

export function resolveOrderPlanName(input: {
  planNameSnapshot: string | null;
  planSlugSnapshot: string | null;
  membershipPlanSlug?: string | null;
  membershipPlanName?: string | null;
}): string | null {
  if (input.planNameSnapshot) {
    return input.planNameSnapshot;
  }
  const planSlug = resolveOrderPlanSlug({
    planSlugSnapshot: input.planSlugSnapshot,
    membershipPlanSlug: input.membershipPlanSlug,
  });
  if (!planSlug) {
    return null;
  }
  return input.membershipPlanName ?? planSlug;
}

export function resolveOrderMealsAllowed(input: {
  mealsAllowedSnapshot: number | null;
  membershipMealsPerWeek?: number | null;
}): number | null {
  if (input.mealsAllowedSnapshot != null && input.mealsAllowedSnapshot > 0) {
    return input.mealsAllowedSnapshot;
  }
  if (input.membershipMealsPerWeek != null && input.membershipMealsPerWeek > 0) {
    return input.membershipMealsPerWeek;
  }
  return null;
}

export function resolveOrderPortion(input: {
  portionSnapshot: Portion | null;
  membershipPortionDefault?: Portion | null;
}): Portion | null {
  if (input.portionSnapshot) {
    return input.portionSnapshot;
  }
  return input.membershipPortionDefault ?? null;
}
