import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import { menuItems } from "./menu-items.ts";
import { portions } from "./order-lines.ts";

/** Stripe Product mirror for a master menu item portion (e.g. Beef Lasagna 4oz). */
export const stripeProducts = mysqlTable(
  "stripe_products",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    menuItemId: varchar("menu_item_id", { length: 36 })
      .notNull()
      .references(() => menuItems.id, { onDelete: "restrict" }),
    /** Portion-specific Stripe Product per Jay's requirement. */
    portion: mysqlEnum("portion", portions).notNull(),
    stripeProductId: varchar("stripe_product_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    active: boolean("active").notNull().default(true),
    /** App-specific product metadata mirrored to/from Stripe Product metadata. */
    stripeMetadata: json("stripe_metadata").$type<Record<string, unknown>>(),
    stripeMetadataUpdatedAt: timestamp("stripe_metadata_updated_at"),
    stripeSyncedAt: timestamp("stripe_synced_at"),
    stripeSyncError: text("stripe_sync_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("stripe_products_stripe_product_id_idx").on(table.stripeProductId),
    uniqueIndex("stripe_products_menu_item_portion_idx").on(table.menuItemId, table.portion),
    index("stripe_products_menu_item_id_idx").on(table.menuItemId),
  ],
);

/** Stripe Price mirror for the active price on a portion-specific Stripe Product. */
export const stripePrices = mysqlTable(
  "stripe_prices",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    stripeProductId: varchar("stripe_product_id", { length: 36 })
      .notNull()
      .references(() => stripeProducts.id, { onDelete: "cascade" }),
    stripePriceId: varchar("stripe_price_id", { length: 255 }).notNull(),
    /** Cached unit amount from Stripe (cents). */
    unitAmountCents: int("unit_amount_cents").notNull(),
    active: boolean("active").notNull().default(true),
    stripeSyncedAt: timestamp("stripe_synced_at"),
    stripeSyncError: text("stripe_sync_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("stripe_prices_stripe_price_id_idx").on(table.stripePriceId),
    index("stripe_prices_stripe_product_id_idx").on(table.stripeProductId),
  ],
);

export type StripeProduct = typeof stripeProducts.$inferSelect;
export type NewStripeProduct = typeof stripeProducts.$inferInsert;
export type StripePrice = typeof stripePrices.$inferSelect;
export type NewStripePrice = typeof stripePrices.$inferInsert;
