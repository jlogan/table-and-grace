#!/usr/bin/env node
/**
 * Validate GOFOFA server environment variables.
 * Usage: npm run env:validate
 *
 * Exits 0 when DATABASE_URL, AUTH_SECRET, and APP_URL are valid.
 * Optional vars (Stripe, Resend, Twilio, CRON_SECRET) are documented but not required in Phase 0.
 */
import { formatServerEnvErrors, SERVER_ENV_KEYS } from "../src/env.server.ts";

const errors = formatServerEnvErrors();

if (errors) {
  console.error("Missing or invalid server environment:\n");
  console.error(errors);
  console.error("\nRequired keys:", SERVER_ENV_KEYS.required.join(", "));
  console.error("Copy .env.example to .env and configure values from Buddy/CloudPanel.");
  process.exit(1);
}

console.log("Server environment OK.");
console.log("Required:", SERVER_ENV_KEYS.required.join(", "));
console.log(
  "Optional (Phase 2+):",
  [
    ...SERVER_ENV_KEYS.stripe,
    ...SERVER_ENV_KEYS.email,
    ...SERVER_ENV_KEYS.sms,
    ...SERVER_ENV_KEYS.jobs,
  ].join(", "),
);
