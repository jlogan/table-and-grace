import { json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const jobRunStatuses = ["running", "completed", "failed"] as const;
export type JobRunStatus = (typeof jobRunStatuses)[number];

/** Idempotent cron / background job runs (Friday charge, batch creation, etc.). */
export const jobs = mysqlTable("jobs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  jobType: varchar("job_type", { length: 64 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull().unique(),
  status: mysqlEnum("status", jobRunStatuses).notNull().default("running"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
