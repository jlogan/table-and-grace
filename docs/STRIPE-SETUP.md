# Stripe setup (GOFOFA Phase 2 foundation)

This pass adds the **data model and server helpers** for Stripe sync. Invoice creation, batch finalization billing, and customer pay flows are implemented in later passes.

## Architecture notes

- **One invoice per order** — app-created invoices link uniquely to `invoices.order_id`; Stripe Dashboard-created invoices can mirror first with a null order until admin links/creates the order.
- **Off-session / variable totals** — use Stripe Invoices + PaymentIntents, not Subscriptions (see this foundation plan).
- **Stripe catalog shape** — each app `menu_items` row is the master product; `stripe_products` stores portion-specific Stripe Products (4oz/6oz), and `stripe_prices` stores their active prices.
- **Payment method per membership** — `memberships.default_payment_method_id` selects the card for a meal plan; account-level default remains on `payment_methods.is_default`.
- **Payment method per order** — `weekly_orders.payment_method_id` overrides membership default for a single order; `invoices.default_payment_method_id` snapshots the resolved card at batch finalization.
- **Customer metadata** — editable in the app (`customer_profiles.stripe_customer_metadata`) and mirrored to Stripe Customer metadata via `src/stripe/customer-metadata.ts`. **Do not** use `STRIPE_MODE` or `site=staging` metadata keys; use separate Stripe accounts or restricted keys per environment instead.
- **Failed charges** — `invoices.last_payment_error_*`, `charges.failure_reason`, and `payment_methods.last_failure_*` support admin visibility. Customers pay open invoices via `hosted_invoice_url` or a retry PaymentIntent tracked on `invoices.stripe_payment_intent_id`.
- **Stripe IDs** — `invoices` and `charges` store Stripe Invoice / PaymentIntent / Charge IDs; `invoice_lines.stripe_price_id` links lines to catalog prices.
- **Catalog sync** — `stripe_products` / `stripe_prices` track `stripe_synced_at` and `stripe_sync_error`; product metadata is mirrored via `stripe_products.stripe_metadata`.

## Environment variables

Set in Buddy / CloudPanel / local `.env` (never commit real values):

| Variable                 | Purpose                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `STRIPE_SECRET_KEY`      | Server API calls (`sk_…` or restricted `rk_…`)               |
| `STRIPE_PUBLISHABLE_KEY` | Payment Element / client (`pk_…`)                            |
| `STRIPE_WEBHOOK_SECRET`  | Webhook signature verification (`whsec_…`)                   |
| `APP_URL`                | Return URLs for hosted invoice / checkout (already required) |

Validate core env: `npm run env:validate`. Stripe vars are optional until billing is enabled; use `isStripeConfigured()` / `requireStripeEnv()` from `src/stripe/client.server.ts`.

## Local webhook forwarding

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli).
2. Log in: `stripe login`
3. Forward events to the app (`src/routes/api/stripe/webhook.ts`):

```bash
stripe listen --forward-to localhost:8080/api/stripe/webhook
```

4. Copy the printed `whsec_…` value into `STRIPE_WEBHOOK_SECRET` for local `.env`.

## Dashboard webhook endpoint (staging / production)

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `{APP_URL}/api/stripe/webhook`
3. Select events from `STRIPE_WEBHOOK_EVENT_TYPES` in `src/stripe/webhook-events.ts`:
   - `customer.created`, `customer.updated`, `customer.deleted`
   - `payment_method.attached`, `payment_method.detached`, `payment_method.automatically_updated`
   - `invoice.created`, `invoice.updated`, `invoice.finalized`, `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`
   - `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
   - `charge.succeeded`, `charge.failed`, `charge.refunded`, `charge.dispute.created`
   - `product.created`, `product.updated`, `product.deleted`
   - `price.created`, `price.updated`, `price.deleted`
   - `checkout.session.completed` when Checkout setup mode is used for saved cards
4. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` for that environment.

## Database migration

After pulling schema changes:

```bash
npm run db:generate   # if developing locally
npm run db:migrate    # apply on staging/prod
```

New tables: `stripe_products`, `stripe_prices`, `invoices`, `invoice_lines`. Extended: `payment_methods`, `memberships`, `customer_profiles`, `charges`, `weekly_orders`, `stripe_events`.

Migration: `0012_stripe_foundation` (core tables plus per-order payment-method override, Stripe IDs, catalog sync, and indexes).

## Server usage

```typescript
import { getStripeClient, isStripeConfigured } from "@/stripe/index.server.ts";

if (isStripeConfigured()) {
  const stripe = getStripeClient();
  // ...
}
```

Import webhook constants from `@/stripe/webhook-events.ts` when wiring future invoice/payment UI flows.

## Security

- Use **restricted API keys** in production when possible.
- Never expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` to the browser.
- Webhook handler must verify signatures with `getStripeWebhookSecret()` before processing.
- Process events idempotently using `stripe_events.stripe_event_id` (already in schema). Index on `type`, `processed_at`, and `created_at` supports audit queries; `livemode` distinguishes test vs production events.
