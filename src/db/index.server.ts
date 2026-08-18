import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { getServerEnv, hasCoreServerEnv } from "../env.server.ts";

import { drizzleSchema } from "./schema/drizzle.ts";

let pool: mysql.Pool | undefined;
let db: MySql2Database<typeof drizzleSchema> | undefined;

function getDatabaseUrl(): string {
  if (hasCoreServerEnv()) {
    return getServerEnv().DATABASE_URL;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example and configure MySQL, or set env vars in Buddy/CloudPanel.",
    );
  }
  return url;
}

/** Server-only Drizzle client. Lazily connects on first use. */
export function getDb(): MySql2Database<typeof drizzleSchema> {
  if (!db) {
    pool = mysql.createPool(getDatabaseUrl());
    db = drizzle(pool, { schema: drizzleSchema, mode: "default" });
  }
  return db;
}

/** Close the pool — useful in scripts and tests. */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    db = undefined;
  }
}
