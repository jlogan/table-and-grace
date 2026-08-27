#!/usr/bin/env node
/**
 * Unit checks for Stripe customer metadata helpers (no database or Stripe API).
 * Usage: npm run test:stripe-metadata
 */
import assert from "node:assert/strict";

import {
  STRIPE_CUSTOMER_METADATA_KEYS,
  buildStripeCustomerMetadata,
  buildStripeCustomerMetadataPayload,
  sanitizeStripeCustomerMetadata,
  storedStripeCustomerMetadata,
} from "../src/stripe/customer-metadata.ts";

function main() {
  const userId = "11111111-1111-4111-8111-111111111111";

  const metadata = buildStripeCustomerMetadata({
    userId,
    preferredName: "Jay",
    phone: "+15551234567",
    birthday: "1990-05-15",
    favoriteCake: "Chocolate",
  });

  assert.equal(metadata[STRIPE_CUSTOMER_METADATA_KEYS.userId], userId);
  assert.equal(metadata[STRIPE_CUSTOMER_METADATA_KEYS.preferredName], "Jay");
  assert.equal(metadata[STRIPE_CUSTOMER_METADATA_KEYS.birthday], "1990-05-15");
  assert.equal(metadata[STRIPE_CUSTOMER_METADATA_KEYS.favoriteCake], "Chocolate");
  assert.equal("STRIPE_MODE" in metadata, false);
  assert.equal("site" in metadata, false);

  const sanitized = sanitizeStripeCustomerMetadata({
    gofofa_user_id: userId,
    preferred_name: "Jay",
    STRIPE_MODE: "staging",
    site: "staging",
    birthday: "",
  });
  assert.deepEqual(sanitized, {
    gofofa_user_id: userId,
    preferred_name: "Jay",
  });

  const payload = buildStripeCustomerMetadataPayload({
    userId,
    preferredName: null,
    phone: "  ",
    birthday: "1990-05-15",
    favoriteCake: "Vanilla",
  });
  assert.equal(payload[STRIPE_CUSTOMER_METADATA_KEYS.userId], userId);
  assert.equal(payload[STRIPE_CUSTOMER_METADATA_KEYS.preferredName], "");
  assert.equal(payload[STRIPE_CUSTOMER_METADATA_KEYS.phone], "");
  assert.equal(payload[STRIPE_CUSTOMER_METADATA_KEYS.birthday], "1990-05-15");
  assert.equal(payload[STRIPE_CUSTOMER_METADATA_KEYS.favoriteCake], "Vanilla");

  const stored = storedStripeCustomerMetadata(payload);
  assert.deepEqual(stored, {
    gofofa_user_id: userId,
    birthday: "1990-05-15",
    favorite_cake: "Vanilla",
  });

  console.log("Stripe customer metadata checks passed.");
}

main();
