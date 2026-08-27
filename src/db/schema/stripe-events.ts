import { boolean, index, json, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Processed Stripe webhook events for idempotency and audit. */
export const stripeEvents = mysqlTable(
  "stripe_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    stripeEventId: varchar("stripe_event_id", { length: 255 }).notNull().unique(),
    type: varchar("type", { length: 128 }).notNull(),
    livemode: boolean("livemode").notNull().default(false),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at"),
    processingError: text("processing_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("stripe_events_type_idx").on(table.type),
    index("stripe_events_processed_at_idx").on(table.processedAt),
    index("stripe_events_created_at_idx").on(table.createdAt),
  ],
);

export type StripeEvent = typeof stripeEvents.$inferSelect;
export type NewStripeEvent = typeof stripeEvents.$inferInsert;
