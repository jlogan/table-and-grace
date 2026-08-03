import { mysqlEnum, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

import { users } from "./users";

export const magicLinkPurposes = ["login", "signup", "verify_email"] as const;
export type MagicLinkPurpose = (typeof magicLinkPurposes)[number];

export const magicLinks = mysqlTable("magic_links", {
  id: varchar("id", { length: 36 }).primaryKey(),
  /** Set once the user record exists; null during email-only signup. */
  userId: varchar("user_id", { length: 36 }).references(() => users.id, {
    onDelete: "cascade",
  }),
  email: varchar("email", { length: 255 }).notNull(),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  purpose: mysqlEnum("purpose", magicLinkPurposes).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MagicLink = typeof magicLinks.$inferSelect;
export type NewMagicLink = typeof magicLinks.$inferInsert;
