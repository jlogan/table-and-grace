import type { PaymentSchedule } from "@/db/schema/payment-schedules.ts";
import type { OrderStatus } from "@/db/schema/weekly-orders.ts";
import type { Portion } from "@/db/schema/order-lines.ts";

export type CustomerOrderSummary = {
  id: string;
  status: OrderStatus;
  totalCents: number;
  batchWeekStart: string;
  pickupLabel: string | null;
  reviewDeadline: string | null;
  needsReview: boolean;
  itemCount: number;
};

export type ReviewOrderLine = {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemNote: string | null;
  portion: Portion;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type ReviewAvailableMeal = {
  batchItemId: string;
  menuItemId: string;
  menuItemName: string;
  menuItemNote: string | null;
  qtyRemaining: number;
};

export type ReviewComment = {
  id: string;
  body: string;
  createdAt: string;
};

export type ReviewLineRequest = {
  id: string;
  type: "substitution" | "zero_out" | "add";
  orderLineId: string | null;
  requestedMenuItemId: string | null;
  requestedMenuItemName: string | null;
  requestedQty: number;
  customerNote: string | null;
  status: "pending" | "accepted" | "rejected";
};

export type WeeklyOrderReview = {
  order: {
    id: string;
    status: OrderStatus;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    paymentScheduleSnapshot: PaymentSchedule | null;
    customerVisibleNote: string | null;
    reviewedAt: string | null;
    approvedAt: string | null;
  };
  batch: {
    id: string;
    weekStart: string;
    pickupDate: string | null;
    reviewDeadline: string | null;
    status: string;
  };
  pickupWindow: {
    id: string;
    label: string;
    dayOfWeek: string;
    timeRange: string;
    locationName: string | null;
  } | null;
  paymentSchedule: PaymentSchedule;
  lines: ReviewOrderLine[];
  availableMeals: ReviewAvailableMeal[];
  comments: ReviewComment[];
  pendingRequests: ReviewLineRequest[];
  canEdit: boolean;
  canApprove: boolean;
  editBlockedReason: string | null;
};

export function centsToLabel(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatOrderStatus(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    draft: "Draft",
    pending_customer_review: "Review needed",
    changes_requested: "Changes pending",
    approved: "Approved",
    charging: "Processing payment",
    ready_for_pickup: "Ready for pickup",
    picked_up: "Picked up",
    payment_failed: "Payment failed",
    skipped: "Skipped",
  };
  return labels[status] ?? status;
}

export function formatPaymentSchedule(schedule: PaymentSchedule): string {
  const labels: Record<PaymentSchedule, string> = {
    weekly_autopay: "Weekly autopay",
    monthly_autopay: "Monthly autopay",
    manual_per_order: "Pay per order",
  };
  return labels[schedule] ?? schedule;
}

export function orderStatusBadgeVariant(
  status: OrderStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "pending_customer_review" || status === "changes_requested") return "default";
  if (status === "payment_failed") return "destructive";
  if (status === "approved" || status === "ready_for_pickup") return "secondary";
  return "outline";
}
