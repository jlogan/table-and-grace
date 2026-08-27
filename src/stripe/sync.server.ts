import { randomUUID } from "node:crypto";

import { and, eq, or, sql } from "drizzle-orm";
import type Stripe from "stripe";

import { getDb } from "@/db/index.server";
import { customerProfiles } from "@/db/schema/customer-profiles";
import { invoiceLines, invoices, type InvoiceStatus } from "@/db/schema/invoices";
import { paymentMethods } from "@/db/schema/payment-methods";
import { stripePrices, stripeProducts } from "@/db/schema/stripe-catalog";
import type { Portion } from "@/db/schema/order-lines";
import { users } from "@/db/schema/users";

function fromUnixSeconds(value: number | null | undefined): Date | null {
  return value ? new Date(value * 1000) : null;
}

function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

function stripeInvoiceStatus(status: Stripe.Invoice.Status | null): InvoiceStatus {
  if (status === "paid" || status === "void" || status === "uncollectible") return status;
  if (status === "open") return "open";
  return "draft";
}

function customerMetadata(customer: Stripe.Customer): Record<string, string> | null {
  return Object.keys(customer.metadata ?? {}).length > 0 ? customer.metadata : null;
}

function parseDateMetadata(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function upsertStripeCustomer(customer: Stripe.Customer): Promise<string | null> {
  if (customer.deleted) return null;

  const db = getDb();
  const email = normalizeEmail(customer.email);
  const metadataUserId = customer.metadata?.gofofa_user_id;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        eq(users.stripeCustomerId, customer.id),
        ...(metadataUserId ? [eq(users.id, metadataUserId)] : []),
        ...(email ? [eq(users.email, email)] : []),
      ),
    )
    .limit(1);

  const userId = existing?.id ?? randomUUID();
  const fullName = customer.name?.trim() || null;

  if (existing) {
    await db
      .update(users)
      .set({
        ...(email ? { email } : {}),
        name: fullName,
        stripeCustomerId: customer.id,
      })
      .where(eq(users.id, userId));
  } else if (email) {
    await db.insert(users).values({
      id: userId,
      email,
      name: fullName,
      role: "customer",
      stripeCustomerId: customer.id,
      emailVerifiedAt: new Date(),
    });
  } else {
    return null;
  }

  const [profile] = await db
    .select({ userId: customerProfiles.userId })
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

  const profileValues = {
    phone: customer.phone ?? null,
    birthday: parseDateMetadata(customer.metadata?.birthday),
    favoriteCake: customer.metadata?.favorite_cake || customer.metadata?.favoriteCake || null,
    stripeCustomerMetadata: customerMetadata(customer),
    stripeCustomerMetadataUpdatedAt: new Date(),
    stripeCustomerSyncedAt: new Date(),
    stripeCustomerSyncError: null,
  };

  if (profile) {
    await db.update(customerProfiles).set(profileValues).where(eq(customerProfiles.userId, userId));
  } else {
    await db.insert(customerProfiles).values({ userId, ...profileValues });
  }

  return userId;
}

export async function markStripeCustomerDeleted(customerId: string): Promise<void> {
  const db = getDb();
  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (!userRow) return;
  await db
    .update(customerProfiles)
    .set({ stripeCustomerSyncedAt: new Date(), stripeCustomerSyncError: "Stripe customer deleted" })
    .where(eq(customerProfiles.userId, userRow.id));
}

export async function upsertStripePaymentMethod(pm: Stripe.PaymentMethod): Promise<void> {
  if (pm.type !== "card" || !pm.card) return;
  const customerId = typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
  if (!customerId) return;

  const db = getDb();
  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  if (!userRow) return;

  const [existing] = await db
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .where(eq(paymentMethods.stripePaymentMethodId, pm.id))
    .limit(1);

  const values = {
    userId: userRow.id,
    stripePaymentMethodId: pm.id,
    stripeCustomerId: customerId,
    brand: pm.card.brand ?? null,
    last4: pm.card.last4 ?? null,
    expMonth: pm.card.exp_month ?? null,
    expYear: pm.card.exp_year ?? null,
    status: "active" as const,
    detachedAt: null,
  };

  if (existing) {
    await db.update(paymentMethods).set(values).where(eq(paymentMethods.id, existing.id));
  } else {
    await db.insert(paymentMethods).values({ id: randomUUID(), ...values });
  }
}

export async function markStripePaymentMethodDetached(pmId: string): Promise<void> {
  await getDb()
    .update(paymentMethods)
    .set({ status: "detached", detachedAt: new Date() })
    .where(eq(paymentMethods.stripePaymentMethodId, pmId));
}

export async function upsertStripeProduct(product: Stripe.Product): Promise<void> {
  const menuItemId = product.metadata?.menu_item_id;
  const portion = product.metadata?.portion;
  if (!menuItemId || (portion !== "4oz" && portion !== "6oz")) return;

  const db = getDb();
  const [existing] = await db
    .select({ id: stripeProducts.id })
    .from(stripeProducts)
    .where(eq(stripeProducts.stripeProductId, product.id))
    .limit(1);

  const values = {
    menuItemId,
    portion: portion as Portion,
    stripeProductId: product.id,
    name: product.name,
    active: product.active,
    stripeMetadata: Object.keys(product.metadata ?? {}).length > 0 ? product.metadata : null,
    stripeMetadataUpdatedAt: new Date(),
    stripeSyncedAt: new Date(),
    stripeSyncError: null,
  };

  if (existing) {
    await db.update(stripeProducts).set(values).where(eq(stripeProducts.id, existing.id));
  } else {
    await db.insert(stripeProducts).values({ id: randomUUID(), ...values });
  }
}

export async function markStripeProductDeleted(stripeProductId: string): Promise<void> {
  await getDb()
    .update(stripeProducts)
    .set({ active: false })
    .where(eq(stripeProducts.stripeProductId, stripeProductId));
}

export async function upsertStripePrice(price: Stripe.Price): Promise<void> {
  const productId = typeof price.product === "string" ? price.product : price.product.id;
  const db = getDb();
  const [localProduct] = await db
    .select({ id: stripeProducts.id })
    .from(stripeProducts)
    .where(eq(stripeProducts.stripeProductId, productId))
    .limit(1);
  if (!localProduct || price.unit_amount == null) return;

  const [existing] = await db
    .select({ id: stripePrices.id })
    .from(stripePrices)
    .where(eq(stripePrices.stripePriceId, price.id))
    .limit(1);

  const values = {
    stripeProductId: localProduct.id,
    stripePriceId: price.id,
    unitAmountCents: price.unit_amount,
    active: price.active,
    stripeSyncedAt: new Date(),
    stripeSyncError: null,
  };

  if (existing) {
    await db.update(stripePrices).set(values).where(eq(stripePrices.id, existing.id));
  } else {
    await db.insert(stripePrices).values({ id: randomUUID(), ...values });
  }
}

export async function markStripePriceDeleted(stripePriceId: string): Promise<void> {
  await getDb()
    .update(stripePrices)
    .set({ active: false })
    .where(eq(stripePrices.stripePriceId, stripePriceId));
}

export async function upsertStripeInvoice(invoice: Stripe.Invoice): Promise<void> {
  const invoiceWithLegacyFields = invoice as Stripe.Invoice & {
    payment_intent?: string | { id: string } | null;
    charge?: string | { id: string } | null;
    tax?: number | null;
  };
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const db = getDb();
  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  if (!userRow) return;

  const orderId = invoice.metadata?.weekly_order_id || invoice.metadata?.order_id || null;
  const [existing] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      or(
        eq(invoices.stripeInvoiceId, invoice.id),
        ...(orderId ? [eq(invoices.orderId, orderId)] : []),
      ),
    )
    .limit(1);

  const paymentIntent = invoiceWithLegacyFields.payment_intent;
  const charge = invoiceWithLegacyFields.charge;
  const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
  const chargeId = typeof charge === "string" ? charge : charge?.id;
  const source = orderId ? "app_batch" : "stripe_dashboard";
  const values = {
    orderId,
    userId: userRow.id,
    membershipId: invoice.metadata?.membership_id || null,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: paymentIntentId ?? null,
    stripeChargeId: chargeId ?? null,
    stripeCustomerId: customerId,
    status: stripeInvoiceStatus(invoice.status),
    source: source as "app_batch" | "stripe_dashboard",
    collectionMethod: invoice.collection_method,
    subtotalCents: invoice.subtotal ?? 0,
    taxCents: invoiceWithLegacyFields.tax ?? 0,
    totalCents: invoice.total ?? 0,
    amountDueCents: invoice.amount_due ?? 0,
    amountPaidCents: invoice.amount_paid ?? 0,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdfUrl: invoice.invoice_pdf ?? null,
    dueAt: fromUnixSeconds(invoice.due_date),
    finalizedAt: fromUnixSeconds(invoice.status_transitions.finalized_at),
    paidAt: fromUnixSeconds(invoice.status_transitions.paid_at),
    voidedAt: fromUnixSeconds(invoice.status_transitions.voided_at),
    attemptCount: invoice.attempt_count ?? 0,
  };

  const invoiceId = existing?.id ?? randomUUID();
  if (existing) {
    await db.update(invoices).set(values).where(eq(invoices.id, invoiceId));
  } else {
    await db.insert(invoices).values({ id: invoiceId, ...values });
  }

  const lines = invoice.lines?.data ?? [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const stripePriceId =
      typeof line.pricing?.price_details?.price === "string"
        ? line.pricing.price_details.price
        : null;
    const [localPrice] = stripePriceId
      ? await db
          .select({ id: stripePrices.id })
          .from(stripePrices)
          .where(eq(stripePrices.stripePriceId, stripePriceId))
          .limit(1)
      : [];
    const [existingLine] = await db
      .select({ id: invoiceLines.id })
      .from(invoiceLines)
      .where(eq(invoiceLines.stripeInvoiceLineItemId, line.id))
      .limit(1);
    const lineValues = {
      invoiceId,
      stripePriceId: localPrice?.id ?? null,
      stripeInvoiceLineItemId: line.id,
      description: line.description ?? "Stripe invoice line",
      quantity: line.quantity ?? 1,
      unitAmountCents: line.amount && line.quantity ? Math.round(line.amount / line.quantity) : 0,
      amountCents: line.amount ?? 0,
      sortOrder: index,
    };
    if (existingLine) {
      await db.update(invoiceLines).set(lineValues).where(eq(invoiceLines.id, existingLine.id));
    } else {
      await db.insert(invoiceLines).values({ id: randomUUID(), ...lineValues });
    }
  }
}

export async function noteInvoicePaymentFailure(
  invoiceId: string,
  message: string | null,
): Promise<void> {
  await getDb()
    .update(invoices)
    .set({
      lastPaymentErrorMessage: message,
      lastPaymentErrorCode: null,
    })
    .where(and(eq(invoices.stripeInvoiceId, invoiceId), sql`${invoices.status} != 'paid'`));
}
