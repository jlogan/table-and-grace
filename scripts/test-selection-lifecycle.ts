#!/usr/bin/env node
/**
 * Unit checks for GOFOFA Phase B1A/B1B selection lifecycle (no database required).
 * Usage: npm run test:selection
 */
import assert from "node:assert/strict";

import {
  classifyActiveMembershipRows,
  OPEN_MENU_FOR_SELECTION_TX_PLAN,
  planOpenMenuOrderCreates,
  resolveMemberMealsPerWeek,
  validateGenerateBatchOrders,
  validateOpenMenuSelectionDeadline,
  type ActiveMembershipRow,
  type PublishEligibleMember,
} from "../src/db/batches.server.ts";
import {
  getMemberDraftOrderSaveState,
  sumMemberDraftOrderMeals,
  validateMemberDraftOrderMeals,
} from "../src/lib/member-draft-validation.ts";
import { CUSTOMER_SELECTION_TX_PLAN } from "../src/db/orders.server.ts";
import { batchStatuses } from "../src/db/schema/weekly-batches.ts";
import { orderStatuses } from "../src/db/schema/weekly-orders.ts";
import { formatBatchStatus, isMembershipBatchEligible } from "../src/orders/admin-types.ts";
import {
  buildSelectionOrderSnapshots,
  resolveOrderMealsAllowed,
  resolveOrderPlanName,
  resolveOrderPlanSlug,
  resolveOrderPortion,
} from "../src/orders/order-snapshots.ts";
import { resolveOrderPaymentSchedule } from "../src/orders/payment-schedule.ts";
import { formatOrderStatus, orderNeedsSelection } from "../src/orders/review-types.ts";
import {
  getOrderSelectionState,
  resolveSelectionSaveStatus,
  resolveSelectionSubmitStatus,
  sumSelectionQty,
  validateSelectionSavePicks,
  validateSelectionSubmitPicks,
} from "../src/orders/selection-types.ts";

function memberRow(
  overrides: Partial<ActiveMembershipRow> & Pick<ActiveMembershipRow, "membershipId" | "userId">,
): ActiveMembershipRow {
  return {
    email: "member@example.com",
    name: "Member",
    planSlug: "performance",
    planName: "Performance",
    mealsPerWeek: 5,
    dietaryTags: null,
    portionDefault: "6oz",
    membershipPaymentSchedule: "weekly_autopay",
    profilePaymentSchedule: "weekly_autopay",
    defaultPickupWindowId: null,
    ...overrides,
  };
}

function eligibleMember(
  overrides: Partial<PublishEligibleMember> &
    Pick<PublishEligibleMember, "membershipId" | "userId">,
): PublishEligibleMember {
  return {
    email: "member@example.com",
    name: "Member",
    planSlug: "performance",
    planName: "Performance",
    mealsPerWeek: 5,
    portionDefault: "6oz",
    membershipPaymentSchedule: "weekly_autopay",
    profilePaymentSchedule: "weekly_autopay",
    defaultPickupWindowId: null,
    ...overrides,
  };
}

function main() {
  // Transaction write plan: every read/write step documented and ordered.
  assert.deepEqual(OPEN_MENU_FOR_SELECTION_TX_PLAN, [
    "read_batch",
    "read_eligible_memberships",
    "read_batch_inventory",
    "read_existing_orders",
    "insert_weekly_orders",
    "re_read_batch",
    "update_batch_status_and_selection_deadline",
  ]);

  // Batch and order status labels cover legacy review flow and new selection statuses.
  for (const status of batchStatuses) {
    const label = formatBatchStatus(status);
    assert.notEqual(label, status, `missing batch label for ${status}`);
  }
  assert.equal(formatBatchStatus("selection_open"), "Selection open");
  assert.equal(formatBatchStatus("pending_customer_review"), "Customer review");

  for (const status of orderStatuses) {
    const label = formatOrderStatus(status);
    assert.notEqual(label, status, `missing order label for ${status}`);
  }
  assert.equal(formatOrderStatus("pending_customer_review"), "Review needed");
  assert.equal(formatOrderStatus("awaiting_selection"), "Awaiting selection");

  // Selection deadline: required, valid, and must be in the future (review_deadline untouched server-side).
  const now = new Date("2026-08-24T12:00:00.000Z");
  assert.throws(
    () => validateOpenMenuSelectionDeadline(new Date("not-a-date"), now),
    /Selection deadline is required/,
  );
  assert.throws(
    () => validateOpenMenuSelectionDeadline(new Date("2026-08-24T11:59:59.000Z"), now),
    /must be in the future/,
  );
  assert.throws(() => validateOpenMenuSelectionDeadline(now, now), /must be in the future/);
  assert.doesNotThrow(() =>
    validateOpenMenuSelectionDeadline(new Date("2026-08-25T00:00:00.000Z"), now),
  );

  // Paused/cancelled memberships are excluded before eligibility classification.
  assert.equal(isMembershipBatchEligible("active"), true);
  assert.equal(isMembershipBatchEligible("paused"), false);
  assert.equal(isMembershipBatchEligible("cancelled"), false);

  // Two active memberships for the same user: 4 meals/4oz and 6 meals/6oz, independent entitlements.
  const sharedUserId = "user-1";
  const dualMembership = classifyActiveMembershipRows([
    memberRow({
      membershipId: "m-a",
      userId: sharedUserId,
      planSlug: "performance",
      planName: "Performance",
      mealsPerWeek: 4,
      portionDefault: "4oz",
      membershipPaymentSchedule: "weekly_autopay",
    }),
    memberRow({
      membershipId: "m-b",
      userId: sharedUserId,
      planSlug: "longevity",
      planName: "Longevity",
      mealsPerWeek: 6,
      portionDefault: "6oz",
      membershipPaymentSchedule: "monthly_autopay",
    }),
  ]);
  assert.equal(dualMembership.eligible.length, 2);
  assert.equal(dualMembership.unresolved.length, 0);
  assert.deepEqual(dualMembership.eligible.map((m) => m.membershipId).sort(), ["m-a", "m-b"]);

  const memberA = dualMembership.eligible.find((m) => m.membershipId === "m-a")!;
  const memberB = dualMembership.eligible.find((m) => m.membershipId === "m-b")!;
  assert.equal(memberA.mealsPerWeek, 4);
  assert.equal(memberA.portionDefault, "4oz");
  assert.equal(memberA.planSlug, "performance");
  assert.equal(memberB.mealsPerWeek, 6);
  assert.equal(memberB.portionDefault, "6oz");
  assert.equal(memberB.planSlug, "longevity");

  const bothOrders = planOpenMenuOrderCreates(dualMembership.eligible, new Set());
  assert.equal(bothOrders.length, 2);
  assert.equal(new Set(bothOrders.map((m) => m.userId)).size, 1);

  // Selection open snapshots meals, portion, plan, and payment schedule per membership.
  const snapshotsA = buildSelectionOrderSnapshots(memberA);
  assert.equal(snapshotsA.mealsAllowedSnapshot, 4);
  assert.equal(snapshotsA.portionSnapshot, "4oz");
  assert.equal(snapshotsA.planSlugSnapshot, "performance");
  assert.equal(snapshotsA.planNameSnapshot, "Performance");
  assert.equal(snapshotsA.paymentScheduleSnapshot, "weekly_autopay");

  const snapshotsB = buildSelectionOrderSnapshots(memberB);
  assert.equal(snapshotsB.mealsAllowedSnapshot, 6);
  assert.equal(snapshotsB.portionSnapshot, "6oz");
  assert.equal(snapshotsB.planSlugSnapshot, "longevity");
  assert.equal(snapshotsB.planNameSnapshot, "Longevity");
  assert.equal(snapshotsB.paymentScheduleSnapshot, "monthly_autopay");

  // Profile payment schedule used when membership schedule absent at snapshot time.
  const profileFallback = buildSelectionOrderSnapshots(
    eligibleMember({
      membershipId: "m-profile",
      userId: "u-profile",
      membershipPaymentSchedule: "weekly_autopay",
      profilePaymentSchedule: "manual_per_order",
    }),
  );
  assert.equal(profileFallback.paymentScheduleSnapshot, "weekly_autopay");

  const profileOnly = buildSelectionOrderSnapshots(
    eligibleMember({
      membershipId: "m-profile-only",
      userId: "u-profile-only",
      membershipPaymentSchedule: "weekly_autopay",
      profilePaymentSchedule: "manual_per_order",
    }),
  );
  assert.equal(
    resolveOrderPaymentSchedule({
      paymentScheduleSnapshot: profileOnly.paymentScheduleSnapshot,
      membershipPaymentSchedule: null,
      profilePaymentSchedule: "manual_per_order",
    }),
    profileOnly.paymentScheduleSnapshot,
  );

  // Second invocation: existing membership ids are skipped (no duplicate orders).
  const existingMembershipIds = new Set(["m-a"]);
  const secondRun = planOpenMenuOrderCreates(dualMembership.eligible, existingMembershipIds);
  assert.equal(secondRun.length, 1);
  assert.equal(secondRun[0]!.membershipId, "m-b");
  assert.equal(
    planOpenMenuOrderCreates(dualMembership.eligible, new Set(["m-a", "m-b"])).length,
    0,
  );

  // Unresolved allowances are skipped without blocking eligible members.
  const mixedAllowances = classifyActiveMembershipRows([
    memberRow({ membershipId: "m-ok", userId: "u1", mealsPerWeek: 4 }),
    memberRow({
      membershipId: "m-unresolved",
      userId: "u2",
      mealsPerWeek: null,
      dietaryTags: null,
    }),
  ]);
  assert.equal(mixedAllowances.eligible.length, 1);
  assert.equal(mixedAllowances.unresolved.length, 1);
  assert.equal(mixedAllowances.eligible[0]!.membershipId, "m-ok");

  // meals:N tag fallback for eligibility.
  assert.equal(resolveMemberMealsPerWeek(null, ["meals:3"]), 3);
  assert.equal(resolveMemberMealsPerWeek(null, ["vegan"]), null);

  // Historical null-membership orders are out of scope for idempotency keys.
  const batchMembershipIds = new Set<string | null>(["m-a", null, null]);
  assert.equal(batchMembershipIds.size, 2);
  assert.ok(!batchMembershipIds.has("m-b"));

  // B1A creates empty orders only — no assignMealsRoundRobin, no order_lines.
  const zeroLineSlots = new Map<string, number>();
  assert.equal(zeroLineSlots.size, 0);

  // Display resolvers prefer snapshots; historical null snapshots fall back to live membership data.
  assert.equal(
    resolveOrderPlanSlug({
      planSlugSnapshot: "performance",
      membershipPlanSlug: "longevity",
    }),
    "performance",
  );
  assert.equal(
    resolveOrderPlanSlug({ planSlugSnapshot: null, membershipPlanSlug: "longevity" }),
    "longevity",
  );

  assert.equal(
    resolveOrderPlanName({
      planNameSnapshot: "Performance",
      planSlugSnapshot: "performance",
      membershipPlanSlug: "longevity",
      membershipPlanName: "Longevity",
    }),
    "Performance",
  );
  assert.equal(
    resolveOrderPlanName({
      planNameSnapshot: null,
      planSlugSnapshot: null,
      membershipPlanSlug: "longevity",
      membershipPlanName: "Longevity",
    }),
    "Longevity",
  );
  assert.equal(
    resolveOrderPlanName({
      planNameSnapshot: null,
      planSlugSnapshot: null,
      membershipPlanSlug: "longevity",
      membershipPlanName: null,
    }),
    "longevity",
  );

  assert.equal(resolveOrderMealsAllowed({ mealsAllowedSnapshot: 4, membershipMealsPerWeek: 6 }), 4);
  assert.equal(
    resolveOrderMealsAllowed({ mealsAllowedSnapshot: null, membershipMealsPerWeek: 6 }),
    6,
  );

  assert.equal(
    resolveOrderPortion({ portionSnapshot: "4oz", membershipPortionDefault: "6oz" }),
    "4oz",
  );
  assert.equal(
    resolveOrderPortion({ portionSnapshot: null, membershipPortionDefault: "6oz" }),
    "6oz",
  );

  // B1B selection state: batch open, deadline, status, and meals_allowed snapshot.
  const deadlineFuture = new Date("2026-08-25T00:00:00.000Z");
  const deadlinePast = new Date("2026-08-24T11:00:00.000Z");

  assert.deepEqual(
    getOrderSelectionState({
      orderStatus: "awaiting_selection",
      batchStatus: "selection_open",
      selectionDeadline: deadlineFuture,
      mealsAllowed: 5,
      now,
    }),
    { canEdit: true, canSubmit: true, editBlockedReason: null },
  );

  assert.deepEqual(
    getOrderSelectionState({
      orderStatus: "selection_in_progress",
      batchStatus: "selection_open",
      selectionDeadline: deadlineFuture,
      mealsAllowed: 4,
      now,
    }),
    { canEdit: true, canSubmit: true, editBlockedReason: null },
  );

  assert.equal(
    getOrderSelectionState({
      orderStatus: "awaiting_selection",
      batchStatus: "selection_open",
      selectionDeadline: deadlinePast,
      mealsAllowed: 5,
      now,
    }).canEdit,
    false,
  );

  assert.equal(
    getOrderSelectionState({
      orderStatus: "awaiting_selection",
      batchStatus: "pending_customer_review",
      selectionDeadline: deadlineFuture,
      mealsAllowed: 5,
      now,
    }).canEdit,
    false,
  );

  assert.equal(
    getOrderSelectionState({
      orderStatus: "selection_submitted",
      batchStatus: "selection_open",
      selectionDeadline: deadlineFuture,
      mealsAllowed: 5,
      now,
    }).canEdit,
    false,
  );

  assert.equal(
    getOrderSelectionState({
      orderStatus: "pending_customer_review",
      batchStatus: "pending_customer_review",
      selectionDeadline: deadlineFuture,
      mealsAllowed: 5,
      now,
    }).canEdit,
    false,
  );

  const realFutureDeadline = new Date("2999-08-25T00:00:00.000Z");
  assert.equal(
    orderNeedsSelection({
      status: "awaiting_selection",
      batchStatus: "selection_open",
      selectionDeadline: realFutureDeadline.toISOString(),
      mealsAllowed: 5,
    }),
    true,
  );

  assert.equal(
    orderNeedsSelection({
      status: "selection_submitted",
      batchStatus: "selection_open",
      selectionDeadline: realFutureDeadline.toISOString(),
      mealsAllowed: 5,
    }),
    false,
  );

  const batchMenu = new Set(["meal-a", "meal-b", "meal-c"]);

  assert.doesNotThrow(() =>
    validateSelectionSavePicks(
      [
        { menuItemId: "meal-a", qty: 2 },
        { menuItemId: "meal-b", qty: 1 },
      ],
      4,
      batchMenu,
    ),
  );

  assert.equal(sumSelectionQty([{ qty: 2 }, { qty: 1 }]), 3);

  assert.equal(resolveSelectionSaveStatus("awaiting_selection"), "selection_in_progress");
  assert.equal(resolveSelectionSaveStatus("selection_in_progress"), "selection_in_progress");

  assert.throws(
    () =>
      validateSelectionSavePicks(
        [
          { menuItemId: "meal-a", qty: 2 },
          { menuItemId: "meal-b", qty: 2 },
          { menuItemId: "meal-c", qty: 1 },
        ],
        4,
        batchMenu,
      ),
    /up to 4 meals/,
  );

  assert.doesNotThrow(() =>
    validateSelectionSavePicks(
      [
        { menuItemId: "meal-a", qty: 2 },
        { menuItemId: "meal-b", qty: 0 },
      ],
      4,
      batchMenu,
    ),
  );

  assert.throws(
    () => validateSelectionSavePicks([{ menuItemId: "meal-a", qty: -1 }], 4, batchMenu),
    /Quantity cannot be negative/,
  );

  assert.throws(
    () =>
      validateSelectionSavePicks(
        [
          { menuItemId: "meal-a", qty: 1 },
          { menuItemId: "meal-a", qty: 1 },
        ],
        4,
        batchMenu,
      ),
    /Duplicate meal selections/,
  );

  assert.throws(
    () => validateSelectionSavePicks([{ menuItemId: "meal-off-menu", qty: 1 }], 4, batchMenu),
    /not on this week's menu/,
  );

  assert.throws(
    () => validateSelectionSubmitPicks([{ menuItemId: "meal-a", qty: 3 }], 4, batchMenu),
    /Select exactly 4 meals/,
  );

  assert.doesNotThrow(() =>
    validateSelectionSubmitPicks(
      [
        { menuItemId: "meal-a", qty: 2 },
        { menuItemId: "meal-b", qty: 1 },
        { menuItemId: "meal-c", qty: 1 },
      ],
      4,
      batchMenu,
    ),
  );
  assert.equal(resolveSelectionSubmitStatus(), "selection_submitted");

  assert.equal(sumSelectionQty([{ qty: 2 }, { qty: 0 }, { qty: 3 }]), 5);

  // B1B concurrency: per-order serialization — lock before validation and writes.
  assert.deepEqual(CUSTOMER_SELECTION_TX_PLAN, [
    "lock_weekly_order",
    "re_read_order_and_batch",
    "read_membership_context",
    "validate_selection_editable",
    "validate_picks",
    "replace_order_lines",
    "recalculate_totals",
    "update_selection_status",
  ]);
  assert.equal(CUSTOMER_SELECTION_TX_PLAN[0], "lock_weekly_order");
  assert.ok(
    CUSTOMER_SELECTION_TX_PLAN.indexOf("validate_selection_editable") >
      CUSTOMER_SELECTION_TX_PLAN.indexOf("lock_weekly_order"),
  );
  assert.ok(
    CUSTOMER_SELECTION_TX_PLAN.indexOf("replace_order_lines") >
      CUSTOMER_SELECTION_TX_PLAN.indexOf("validate_selection_editable"),
  );

  const generateIssues = validateGenerateBatchOrders([
    {
      membershipId: "m1",
      memberLabel: "Alex (alex@example.com)",
      planSlug: null,
      mealsPerWeek: 5,
      lines: [{ menuItemName: "Chicken", qty: 2, unitPriceCents: 0 }],
    },
  ]);
  assert.equal(generateIssues.length, 2);
  assert.ok(generateIssues.some((issue) => issue.message.includes("Missing membership plan")));
  assert.ok(generateIssues.some((issue) => issue.message.includes("no price")));

  assert.equal(
    validateGenerateBatchOrders([
      {
        membershipId: "m2",
        memberLabel: "Blake",
        planSlug: "performance",
        mealsPerWeek: 5,
        lines: [{ menuItemName: "Salmon", qty: 1, unitPriceCents: 1200 }],
      },
    ]).length,
    0,
  );

  assert.equal(sumMemberDraftOrderMeals([{ qty: 6 }, { qty: 7 }, { qty: 0 }]), 13);
  assert.doesNotThrow(() => validateMemberDraftOrderMeals(14, 14));
  assert.doesNotThrow(() => validateMemberDraftOrderMeals(13, 14));
  assert.throws(
    () => validateMemberDraftOrderMeals(15, 14),
    /This order exceeds the member's 14-meal allowance\./,
  );
  assert.throws(
    () => validateMemberDraftOrderMeals(sumMemberDraftOrderMeals([{ qty: 8 }, { qty: 7 }]), 14),
    /This order exceeds the member's 14-meal allowance\./,
  );
  assert.throws(
    () => validateMemberDraftOrderMeals(0, 14),
    /Add at least one meal before saving this draft\./,
  );

  assert.deepEqual(getMemberDraftOrderSaveState({ totalMeals: 13, mealsPerWeek: 14 }), {
    canSave: true,
    blockedReason: null,
  });
  assert.deepEqual(getMemberDraftOrderSaveState({ totalMeals: 14, mealsPerWeek: 14 }), {
    canSave: true,
    blockedReason: null,
  });
  assert.equal(getMemberDraftOrderSaveState({ totalMeals: 15, mealsPerWeek: 14 }).canSave, false);
  assert.equal(getMemberDraftOrderSaveState({ totalMeals: 0, mealsPerWeek: 14 }).canSave, false);
  assert.match(
    getMemberDraftOrderSaveState({ totalMeals: 19, mealsPerWeek: 14 }).blockedReason ?? "",
    /This order exceeds the member's 14-meal allowance\./,
  );

  console.log("Selection lifecycle checks passed.");
}

main();
