#!/usr/bin/env node
/**
 * Unit checks for auth primitives (no database required).
 * Usage: npm run test:auth
 */
import assert from "node:assert/strict";

import { generateSecureToken, hashToken, verifyTokenHash } from "../src/auth/token.server.ts";
import { hashPassword, verifyPassword } from "../src/auth/password.server.ts";

async function main() {
  const token = generateSecureToken();
  assert.equal(typeof token, "string");
  assert.ok(token.length >= 32);

  const tokenHash = hashToken(token);
  assert.ok(verifyTokenHash(token, tokenHash));
  assert.equal(verifyTokenHash("wrong-token", tokenHash), false);

  const password = "test-password-123";
  const stored = await hashPassword(password);
  assert.ok(stored.startsWith("scrypt$"));
  assert.equal(await verifyPassword(password, stored), true);
  assert.equal(await verifyPassword("wrong-password", stored), false);

  console.log("Auth primitive checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
