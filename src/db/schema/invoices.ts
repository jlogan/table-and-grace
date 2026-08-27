import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import { memberships } from "./memberships.ts";
import { orderLines } from "./order-lines.ts";
import { paymentMethods } from "./payment-methods.ts";
import { stripePrices } from "./stripe-catalog.ts";
import { users } from "./users.ts";
import { weeklyOrders } from "./weekly-orders.ts";

/** Mirrors Stripe Invoice lifecycle for one weekly order (created at batch finalization). */
export const invoiceStatuses = ["draft", "open", "paid", "void", "uncollectible"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const invoiceCollectionMethods = ["charge_automatically", "send_invoice"] as const;
export type InvoiceCollectionMethod = (typeof invoiceCollectionMethods)[number];

export const invoiceSources = ["app_batch", "stripe_dashboard"] as const;
export type InvoiceSource = (typeof invoiceSources)[number];

export const invoices = mysqlTable(
  "invoices",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    /** Exactly one invoice per order when app-created; nullable for Stripe-created invoices before admin links/creates an order. */
    orderId: varchar("order_id", { length: 36 }).references(() => weeklyOrders.id, {
      onDelete: "set null",
    }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    membershipId: varchar("membership_id", { length: 36 }).references(() => memberships.id, {
      onDelete: "set null",
    }),
    /** Set when the Stripe Invoice is created at batch finalization. */
    stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }),
    /** Latest PaymentIntent for pay/retry flows (hosted invoice or off-session). */
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    /** Latest succeeded Charge on the invoice, when present. */
    stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).notNull(),
    /** Card snapshot at finalization (order override → membership default → account default). */
    defaultPaymentMethodId: varchar("default_payment_method_id", { length: 36 }).references(
      () => paymentMethods.id,
      { onDelete: "set null" },
    ),
    status: mysqlEnum("status", invoiceStatuses).notNull().default("draft"),
    source: mysqlEnum("source", invoiceSources).notNull().default("app_batch"),
    collectionMethod: mysqlEnum("collection_method", invoiceCollectionMethods)
      .notNull()
      .default("charge_automatically"),
    subtotalCents: int("subtotal_cents").notNull().default(0),
    taxCents: int("tax_cents").notNull().default(0),
    totalCents: int("total_cents").notNull().default(0),
    amountDueCents: int("amount_due_cents").notNull().default(0),
    amountPaidCents: int("amount_paid_cents").notNull().default(0),
    hostedInvoiceUrl: varchar("hosted_invoice_url", { length: 2048 }),
    invoicePdfUrl: varchar("invoice_pdf_url", { length: 2048 }),
    dueAt: timestamp("due_at"),
    finalizedAt: timestamp("finalized_at"),
    paidAt: timestamp("paid_at"),
    voidedAt: timestamp("voided_at"),
    /** Latest failed charge attempt — surfaced in admin. */
    lastPaymentErrorCode: varchar("last_payment_error_code", { length: 64 }),
    lastPaymentErrorMessage: text("last_payment_error_message"),
    attemptCount: int("attempt_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("invoices_order_id_idx").on(table.orderId),
    uniqueIndex("invoices_stripe_invoice_id_idx").on(table.stripeInvoiceId),
    uniqueIndex("invoices_stripe_payment_intent_id_idx").on(table.stripePaymentIntentId),
    uniqueIndex("invoices_stripe_charge_id_idx").on(table.stripeChargeId),
    index("invoices_user_id_idx").on(table.userId),
    index("invoices_membership_id_idx").on(table.membershipId),
    index("invoices_status_idx").on(table.status),
    index("invoices_stripe_customer_id_idx").on(table.stripeCustomerId),
    index("invoices_default_payment_method_id_idx").on(table.defaultPaymentMethodId),
  ],
);

export const invoiceLines = mysqlTable(
  "invoice_lines",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    invoiceId: varchar("invoice_id", { length: 36 })
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    orderLineId: varchar("order_line_id", { length: 36 }).references(() => orderLines.id, {
      onDelete: "set null",
    }),
    /** Local mirror of the Stripe Price used for this line (catalog source of truth). */
    stripePriceId: varchar("stripe_price_id", { length: 36 }).references(() => stripePrices.id, {
      onDelete: "set null",
    }),
    stripeInvoiceLineItemId: varchar("stripe_invoice_line_item_id", { length: 255 }),
    description: text("description").notNull(),
    quantity: int("quantity").notNull().default(1),
    unitAmountCents: int("unit_amount_cents").notNull().default(0),
    amountCents: int("amount_cents").notNull().default(0),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("invoice_lines_stripe_line_item_id_idx").on(table.stripeInvoiceLineItemId),
    index("invoice_lines_invoice_id_idx").on(table.invoiceId),
    index("invoice_lines_order_line_id_idx").on(table.orderLineId),
    index("invoice_lines_stripe_price_id_idx").on(table.stripePriceId),
  ],
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type NewInvoiceLine = typeof invoiceLines.$inferInsert;
