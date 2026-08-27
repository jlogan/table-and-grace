import Stripe from "stripe";

import { getServerEnv, hasStripeEnv } from "@/env.server.ts";

/** API version supported by the pinned Stripe SDK in this repo. */
export const STRIPE_API_VERSION = "2026-02-25.clover" as const;

let cachedStripeClient: Stripe | undefined;

/** True when all Stripe env vars required for billing are configured. */
export function isStripeConfigured(): boolean {
  return hasStripeEnv();
}

/** Stripe env vars or throw — use before server-side Stripe API calls. */
export function requireStripeEnv() {
  if (!hasStripeEnv()) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PUBLISHABLE_KEY.",
    );
  }
  return getServerEnv();
}

/** Publishable key for Payment Element (server passes to client loaders). */
export function getStripePublishableKey(): string {
  const env = requireStripeEnv();
  return env.STRIPE_PUBLISHABLE_KEY!;
}

/** Webhook signing secret for `constructEvent` verification. */
export function getStripeWebhookSecret(): string {
  const env = requireStripeEnv();
  return env.STRIPE_WEBHOOK_SECRET!;
}

/** Lazily initialized Stripe SDK client (server-only). */
export function getStripeClient(): Stripe {
  if (!cachedStripeClient) {
    const env = requireStripeEnv();
    cachedStripeClient = new Stripe(env.STRIPE_SECRET_KEY!, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return cachedStripeClient;
}

/** Reset cached client — tests only. */
export function resetStripeClientCache(): void {
  cachedStripeClient = undefined;
}
