#!/usr/bin/env node
/**
 * Promote a user to admin by email (local/staging ops helper).
 * Usage: npm run db:promote-admin -- user@example.com
 */
import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/db/index.server.ts";
import { users } from "../src/db/schema/users.ts";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run db:promote-admin -- user@example.com");
  process.exit(1);
}

async function main() {
  const db = getDb();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
  console.log(`Promoted ${email} to admin.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
