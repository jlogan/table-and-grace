import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { getDb } from "@/db/index.server";
import { stripeEvents } from "@/db/schema/stripe-events";
import { getStripeClient, getStripeWebhookSecret } from "@/stripe/client.server";
import {
  markStripeCustomerDeleted,
  markStripePaymentMethodDetached,
  markStripePriceDeleted,
  markStripeProductDeleted,
  noteInvoicePaymentFailure,
  upsertStripeCustomer,
  upsertStripeInvoice,
  upsertStripePaymentMethod,
  upsertStripePrice,
  upsertStripeProduct,
} from "@/stripe/sync.server";
import { STRIPE_WEBHOOK_EVENTS } from "@/stripe/webhook-events";

export function constructStripeWebhookEvent(payload: string, signature: string): Stripe.Event {
  return getStripeClient().webhooks.constructEvent(payload, signature, getStripeWebhookSecret());
}

async function recordStripeEvent(event: Stripe.Event): Promise<"new" | "duplicate"> {
  const db = getDb();
  const [existing] = await db
    .select({ stripeEventId: stripeEvents.stripeEventId })
    .from(stripeEvents)
    .where(eq(stripeEvents.stripeEventId, event.id))
    .limit(1);

  if (existing) return "duplicate";

  await db.insert(stripeEvents).values({
    id: randomUUID(),
    stripeEventId: event.id,
    type: event.type,
    livemode: event.livemode,
    payload: event as unknown as Record<string, unknown>,
  });

  return "new";
}

async function markStripeEventProcessed(eventId: string): Promise<void> {
  await getDb()
    .update(stripeEvents)
    .set({ processedAt: new Date(), processingError: null })
    .where(eq(stripeEvents.stripeEventId, eventId));
}

async function markStripeEventFailed(eventId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await getDb()
    .update(stripeEvents)
    .set({ processingError: message })
    .where(eq(stripeEvents.stripeEventId, eventId));
}

function stripeObjectId(object: Stripe.Event.Data.Object): string {
  return (object as { id: string }).id;
}

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  const object = event.data.object;
  const objectId = stripeObjectId(object);

  switch (event.type) {
    case STRIPE_WEBHOOK_EVENTS.customerCreated:
    case STRIPE_WEBHOOK_EVENTS.customerUpdated:
      await upsertStripeCustomer(object as Stripe.Customer);
      break;

    case STRIPE_WEBHOOK_EVENTS.customerDeleted:
      if (objectId) await markStripeCustomerDeleted(objectId);
      break;

    case STRIPE_WEBHOOK_EVENTS.paymentMethodAttached:
    case STRIPE_WEBHOOK_EVENTS.paymentMethodAutomaticallyUpdated:
      await upsertStripePaymentMethod(object as Stripe.PaymentMethod);
      break;

    case STRIPE_WEBHOOK_EVENTS.paymentMethodDetached:
      await markStripePaymentMethodDetached((object as Stripe.PaymentMethod).id);
      break;

    case STRIPE_WEBHOOK_EVENTS.productCreated:
    case STRIPE_WEBHOOK_EVENTS.productUpdated:
      await upsertStripeProduct(object as Stripe.Product);
      break;

    case STRIPE_WEBHOOK_EVENTS.productDeleted:
      if (objectId) await markStripeProductDeleted(objectId);
      break;

    case STRIPE_WEBHOOK_EVENTS.priceCreated:
    case STRIPE_WEBHOOK_EVENTS.priceUpdated:
      await upsertStripePrice(object as Stripe.Price);
      break;

    case STRIPE_WEBHOOK_EVENTS.priceDeleted:
      if (objectId) await markStripePriceDeleted(objectId);
      break;

    case STRIPE_WEBHOOK_EVENTS.invoiceCreated:
    case STRIPE_WEBHOOK_EVENTS.invoiceUpdated:
    case STRIPE_WEBHOOK_EVENTS.invoiceFinalized:
    case STRIPE_WEBHOOK_EVENTS.invoicePaid:
    case STRIPE_WEBHOOK_EVENTS.invoiceVoided:
    case STRIPE_WEBHOOK_EVENTS.invoiceMarkedUncollectible:
      await upsertStripeInvoice(object as Stripe.Invoice);
      break;

    case STRIPE_WEBHOOK_EVENTS.invoicePaymentFailed: {
      const invoice = object as Stripe.Invoice;
      await upsertStripeInvoice(invoice);
      await noteInvoicePaymentFailure(invoice.id, "Stripe invoice payment failed");
      break;
    }

    case STRIPE_WEBHOOK_EVENTS.checkoutSessionCompleted: {
      const session = object as Stripe.Checkout.Session;
      if (session.customer && typeof session.customer === "string") {
        const customer = await getStripeClient().customers.retrieve(session.customer);
        if (!customer.deleted) await upsertStripeCustomer(customer);
      }
      if (session.setup_intent && typeof session.setup_intent === "string") {
        const setupIntent = await getStripeClient().setupIntents.retrieve(session.setup_intent, {
          expand: ["payment_method"],
        });
        const paymentMethod = setupIntent.payment_method;
        if (paymentMethod && typeof paymentMethod !== "string") {
          await upsertStripePaymentMethod(paymentMethod);
        }
      }
      break;
    }

    default:
      break;
  }
}

export async function handleStripeWebhookRequest(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ ok: false, error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructStripeWebhookEvent(await request.text(), signature);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return Response.json({ ok: false, error: "Invalid Stripe signature" }, { status: 400 });
  }

  const state = await recordStripeEvent(event);
  if (state === "duplicate") {
    return Response.json({ ok: true, duplicate: true });
  }

  try {
    await processStripeWebhookEvent(event);
    await markStripeEventProcessed(event.id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`Stripe webhook processing failed for ${event.id}`, error);
    await markStripeEventFailed(event.id, error);
    return Response.json({ ok: false, error: "Webhook processing failed" }, { status: 500 });
  }
}
