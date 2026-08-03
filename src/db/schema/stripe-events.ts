import { json, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Processed Stripe webhook events for idempotency and audit. */
export const stripeEvents = mysqlTable("stripe_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  stripeEventId: varchar("stripe_event_id", { length: 255 }).notNull().unique(),
  type: varchar("type", { length: 128 }).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  processedAt: timestamp("processed_at"),
  processingError: text("processing_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StripeEvent = typeof stripeEvents.$inferSelect;
export type NewStripeEvent = typeof stripeEvents.$inferInsert;
