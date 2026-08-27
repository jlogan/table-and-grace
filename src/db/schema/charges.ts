import {
  int,
  index,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import { billingCycles } from "./billing-cycles.ts";
import { invoices } from "./invoices.ts";
import { paymentMethods } from "./payment-methods.ts";
import { weeklyOrders } from "./weekly-orders.ts";

export const chargeStatuses = ["pending", "succeeded", "failed", "cancelled"] as const;
export type ChargeStatus = (typeof chargeStatuses)[number];

export const charges = mysqlTable(
  "charges",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 })
      .notNull()
      .references(() => weeklyOrders.id, { onDelete: "cascade" }),
    /** Set when charge is part of a monthly billing cycle aggregate. */
    billingCycleId: varchar("billing_cycle_id", { length: 36 }).references(() => billingCycles.id, {
      onDelete: "set null",
    }),
    /** One invoice per order; charges link to the mirrored invoice when present. */
    invoiceId: varchar("invoice_id", { length: 36 }).references(() => invoices.id, {
      onDelete: "set null",
    }),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
    /** Card used for this charge attempt. */
    paymentMethodId: varchar("payment_method_id", { length: 36 }).references(
      () => paymentMethods.id,
      { onDelete: "set null" },
    ),
    amountCents: int("amount_cents").notNull(),
    status: mysqlEnum("status", chargeStatuses).notNull().default("pending"),
    failureReason: text("failure_reason"),
    chargedAt: timestamp("charged_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("charges_invoice_id_idx").on(table.invoiceId),
    index("charges_order_id_idx").on(table.orderId),
    index("charges_status_idx").on(table.status),
    uniqueIndex("charges_stripe_payment_intent_id_idx").on(table.stripePaymentIntentId),
    uniqueIndex("charges_stripe_charge_id_idx").on(table.stripeChargeId),
  ],
);

export type Charge = typeof charges.$inferSelect;
export type NewCharge = typeof charges.$inferInsert;
