import { json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { users } from "./users";
import { weeklyOrders } from "./weekly-orders";

export const notificationChannels = ["email", "sms"] as const;
export type NotificationChannel = (typeof notificationChannels)[number];

export const notificationStatuses = ["pending", "sent", "failed", "skipped"] as const;
export type NotificationStatus = (typeof notificationStatuses)[number];

/** Outbox for email/SMS delivery (assembled order, charge reminders, etc.). */
export const notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, {
    onDelete: "set null",
  }),
  orderId: varchar("order_id", { length: 36 }).references(() => weeklyOrders.id, {
    onDelete: "set null",
  }),
  channel: mysqlEnum("channel", notificationChannels).notNull(),
  templateKey: varchar("template_key", { length: 64 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 255 }),
  status: mysqlEnum("status", notificationStatuses).notNull().default("pending"),
  payload: json("payload").$type<Record<string, unknown>>(),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
