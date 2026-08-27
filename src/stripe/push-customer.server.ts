import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { getDb } from "@/db/index.server";
import { customerProfiles } from "@/db/schema/customer-profiles";
import { users } from "@/db/schema/users";
import { customerFullName } from "@/lib/customer-names";
import { toIsoDateString } from "@/lib/dates";

import { getStripeClient, isStripeApiConfigured } from "./client.server";
import {
  buildStripeCustomerMetadataPayload,
  storedStripeCustomerMetadata,
} from "./customer-metadata";

export type SyncAppCustomerToStripeResult =
  | { status: "skipped"; reason: "stripe_not_configured" }
  | { status: "synced"; stripeCustomerId: string }
  | { status: "error"; message: string };

function stripeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isStripeMissingResource(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "resource_missing"
  );
}

async function recordStripeCustomerSyncFailure(userId: string, message: string): Promise<void> {
  await getDb()
    .update(customerProfiles)
    .set({ stripeCustomerSyncError: message.slice(0, 2000) })
    .where(eq(customerProfiles.userId, userId));
}

async function recordStripeCustomerSyncSuccess(
  userId: string,
  customer: Stripe.Customer,
  metadata: Record<string, string>,
): Promise<void> {
  const db = getDb();
  await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, userId));

  await db
    .update(customerProfiles)
    .set({
      stripeCustomerMetadata: storedStripeCustomerMetadata(metadata),
      stripeCustomerMetadataUpdatedAt: new Date(),
      stripeCustomerSyncedAt: new Date(),
      stripeCustomerSyncError: null,
    })
    .where(eq(customerProfiles.userId, userId));
}

/**
 * Create or update the Stripe Customer for an app user after local create/edit.
 * Never throws — callers can always complete local customer creation first.
 */
export async function syncAppCustomerToStripe(
  userId: string,
): Promise<SyncAppCustomerToStripeResult> {
  if (!isStripeApiConfigured()) {
    return { status: "skipped", reason: "stripe_not_configured" };
  }

  const db = getDb();
  const [row] = await db
    .select({
      email: users.email,
      stripeCustomerId: users.stripeCustomerId,
      firstName: users.firstName,
      lastName: users.lastName,
      preferredName: users.preferredName,
      name: users.name,
      phone: customerProfiles.phone,
      birthday: customerProfiles.birthday,
      favoriteCake: customerProfiles.favoriteCake,
    })
    .from(users)
    .innerJoin(customerProfiles, eq(customerProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    const message = "Customer profile not found for Stripe sync";
    await recordStripeCustomerSyncFailure(userId, message);
    return { status: "error", message };
  }

  const metadata = buildStripeCustomerMetadataPayload({
    userId,
    preferredName: row.preferredName,
    phone: row.phone,
    birthday: toIsoDateString(row.birthday),
    favoriteCake: row.favoriteCake,
  });

  const stripe = getStripeClient();
  const params: Stripe.CustomerCreateParams = {
    email: row.email,
    name: customerFullName(row) ?? undefined,
    phone: row.phone ?? undefined,
    metadata,
  };

  try {
    let customer: Stripe.Customer;
    if (row.stripeCustomerId) {
      try {
        customer = await stripe.customers.update(row.stripeCustomerId, params);
      } catch (error) {
        if (!isStripeMissingResource(error)) throw error;
        customer = await stripe.customers.create(params);
      }
    } else {
      customer = await stripe.customers.create(params);
    }

    if (customer.deleted) {
      const message = "Stripe returned a deleted customer";
      await recordStripeCustomerSyncFailure(userId, message);
      return { status: "error", message };
    }

    await recordStripeCustomerSyncSuccess(userId, customer, metadata);
    return { status: "synced", stripeCustomerId: customer.id };
  } catch (error) {
    const message = stripeErrorMessage(error);
    console.error(`Stripe customer sync failed for user ${userId}:`, error);
    await recordStripeCustomerSyncFailure(userId, message);
    return { status: "error", message };
  }
}
