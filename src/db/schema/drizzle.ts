import { batchItems } from "./batch-items.ts";
import { billingCycles } from "./billing-cycles.ts";
import { charges } from "./charges.ts";
import { customerProfiles } from "./customer-profiles.ts";
import { invoiceLines, invoices } from "./invoices.ts";
import { jobs } from "./jobs.ts";
import { magicLinks } from "./magic-links.ts";
import { memberships } from "./memberships.ts";
import { menuItems } from "./menu-items.ts";
import { notifications } from "./notifications.ts";
import { orderComments } from "./order-comments.ts";
import { orderLineRequests } from "./order-line-requests.ts";
import { orderLines } from "./order-lines.ts";
import { paymentMethods } from "./payment-methods.ts";
import { pickupWindows } from "./pickup-windows.ts";
import { planCategories } from "./plan-categories.ts";
import { sessions } from "./sessions.ts";
import { stripeEvents } from "./stripe-events.ts";
import { stripePrices, stripeProducts } from "./stripe-catalog.ts";
import { users } from "./users.ts";
import { weeklyBatches } from "./weekly-batches.ts";
import { weeklyOrders } from "./weekly-orders.ts";

/** All Drizzle tables for `getDb()`. Import types/constants from individual schema files. */
export const drizzleSchema = {
  batchItems,
  billingCycles,
  charges,
  customerProfiles,
  invoiceLines,
  invoices,
  jobs,
  magicLinks,
  memberships,
  menuItems,
  notifications,
  orderComments,
  orderLineRequests,
  orderLines,
  paymentMethods,
  pickupWindows,
  planCategories,
  sessions,
  stripeEvents,
  stripePrices,
  stripeProducts,
  users,
  weeklyBatches,
  weeklyOrders,
};
