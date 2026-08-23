import type { PortionDefault } from "@/db/schema/customer-profiles.ts";
import type { BillingProfile, MembershipStatus } from "@/db/schema/memberships.ts";
import type { PaymentSchedule } from "@/db/schema/payment-schedules.ts";
import type { UserRole } from "@/db/schema/users.ts";
import type { BatchStatus } from "@/db/schema/weekly-batches.ts";
import type { OrderStatus } from "@/db/schema/weekly-orders.ts";
import { formatDateString } from "@/lib/dates.ts";

export type AdminBatchSummary = {
  id: string;
  weekStart: string;
  pickupDate: string | null;
  status: BatchStatus;
  reviewDeadline: string | null;
  chargeScheduledAt: string | null;
  pickupWindowLabel: string | null;
  orderCount: number;
  itemCount: number;
};

export type AdminMenuItemOption = {
  id: string;
  name: string;
  note: string | null;
};

export type AdminMenuItemRow = {
  id: string;
  slug: string;
  name: string;
  note: string | null;
  categoryId: string | null;
  categoryName: string | null;
  price4ozCents: number | null;
  price6ozCents: number | null;
  sortOrder: number;
  active: boolean;
};

export type AdminPlanCategoryWithId = {
  id: string;
  slug: string;
  name: string;
};

export type AdminBatchInventoryRow = {
  batchItemId: string | null;
  menuItemId: string;
  menuItemName: string;
  qtyCooked: number;
  qtyRemaining: number;
};

export type AdminPickupWindowOption = {
  id: string;
  label: string;
};

export type AdminOrderRow = {
  id: string;
  batchId: string;
  batchWeekStart: string;
  customerName: string | null;
  customerEmail: string;
  status: OrderStatus;
  paymentSchedule: PaymentSchedule;
  totalCents: number;
  itemCount: number;
  pickupLabel: string | null;
  customerVisibleNote: string | null;
  reviewDeadline: string | null;
  membershipId: string | null;
  planSlug: string | null;
  planName: string | null;
};

export function formatBatchStatus(status: BatchStatus): string {
  const labels: Record<BatchStatus, string> = {
    planning: "Planning",
    draft: "Draft",
    pending_customer_review: "Customer review",
    approved: "Approved",
    charging: "Charging",
    closed: "Closed",
  };
  return labels[status] ?? status;
}

export function batchStatusBadgeVariant(
  status: BatchStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "pending_customer_review") return "default";
  if (status === "planning" || status === "draft") return "outline";
  if (status === "closed") return "secondary";
  return "secondary";
}

export type AdminPlanCategoryOption = {
  slug: string;
  name: string;
};

export type AdminCustomerRow = {
  userId: string;
  email: string;
  /** Legacy single-field name; preserved for existing rows. */
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  role: UserRole;
  createdAt: string;
  phone: string | null;
  birthday: string | null;
  favoriteCake: string | null;
  /** Present when a photo URL exists; not edited via raw URL field in admin UI. */
  hasProfilePhoto: boolean;
  allergies: string | null;
  /** Display tags only — excludes reserved plan:/meals: prefixes. */
  dietaryTags: string[];
  membershipCount: number;
  activeMembershipCount: number;
  primaryMembershipStatus: MembershipStatus | null;
  portionDefault: PortionDefault;
  chefNotes: string | null;
  orderCount: number;
};

export type AdminCustomerMembershipSummary = {
  membershipId: string;
  membershipStatus: MembershipStatus;
  pausedUntil: string | null;
  planSlug: string | null;
  planName: string | null;
  mealsPerWeek: number | null;
  portionDefault: PortionDefault;
  paymentSchedule: PaymentSchedule;
};

export type AdminCustomerOrderSummary = {
  id: string;
  batchId: string;
  batchWeekStart: string;
  status: OrderStatus;
  paymentSchedule: PaymentSchedule;
  totalCents: number;
  itemCount: number;
  pickupLabel: string | null;
  membershipId: string | null;
  planSlug: string | null;
  planName: string | null;
};

export type AdminCustomerDetail = {
  userId: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  createdAt: string;
  phone: string | null;
  birthday: string | null;
  favoriteCake: string | null;
  hasProfilePhoto: boolean;
  /** Admin-only display URL when a photo exists; never edited via raw URL field in UI. */
  profilePhotoUrl: string | null;
  allergies: string | null;
  dietaryTags: string[];
  portionDefault: PortionDefault;
  chefNotes: string | null;
  memberships: AdminCustomerMembershipSummary[];
  orders: AdminCustomerOrderSummary[];
};

export type AdminMembershipRow = {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  membershipStatus: MembershipStatus;
  pausedUntil: string | null;
  batchEligible: boolean;
  paymentSchedule: PaymentSchedule;
  portionDefault: PortionDefault;
  planSlug: string | null;
  planName: string | null;
  mealsPerWeek: number | null;
  billingProfile: BillingProfile;
  fixedPricePerMealCents: number | null;
  discountCents: number;
  discountLabel: string | null;
  weeklyInvoiceDay: number | null;
  monthlyInvoiceDay: number | null;
  biweeklyAnchorDate: string | null;
};

export function isMembershipBatchEligible(status: MembershipStatus): boolean {
  return status === "active";
}

export function formatBatchEligibility(eligible: boolean): string {
  return eligible ? "Eligible" : "Not eligible";
}

export function formatBillingProfile(profile: BillingProfile): string {
  return profile === "fixed_price" ? "Fixed price" : "Catalog";
}

export type BatchMealDemandRow = {
  menuItemId: string;
  menuItemName: string;
  qtyNeeded: number;
  qtyCooked: number;
  qtyRemaining: number;
};

export type AdminDashboardOverview = {
  currentBatch: AdminBatchSummary | null;
  reviewQueueCount: number;
  activeMemberCount: number;
  customerCount: number;
  recentOrders: AdminOrderRow[];
  prepTotals: BatchMealDemandRow[];
  upcomingCustomers: AdminMembershipRow[];
};

export function membershipStatusBadgeVariant(
  status: MembershipStatus | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "paused") return "outline";
  if (status === "cancelled") return "secondary";
  return "secondary";
}

export function formatMembershipStatus(
  status: MembershipStatus | null,
  pausedUntil?: string | null,
): string {
  if (!status) return "No membership";
  const labels: Record<MembershipStatus, string> = {
    active: "Active",
    paused: "Paused",
    cancelled: "Cancelled",
  };
  const base = labels[status] ?? status;
  if (status === "paused" && pausedUntil) {
    return `${base} until ${formatDateString(pausedUntil, "MMM d, yyyy")}`;
  }
  return base;
}
