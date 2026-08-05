# GOFOFA — Implementation Plan

GOFOFA is the meal-prep weekly membership and order-batching ecommerce backend for **Table and Grace**. It runs in this repo on the `staging` branch alongside the existing TanStack Start storefront.

## Stack

| Layer            | Choice                                                    |
| ---------------- | --------------------------------------------------------- |
| Frontend         | React 19, TanStack Router/Start, TanStack Query           |
| Server           | TanStack Start (Nitro `node-server`)                      |
| Database         | MySQL 8+                                                  |
| ORM / migrations | Drizzle ORM + drizzle-kit                                 |
| Payments         | Stripe (saved cards, off-session variable weekly charges) |
| Roles            | `customer`, `admin`                                       |

## Design shells (Phase 1 layout pass)

Three visual scopes — marketing pages keep the existing Table and Grace `PageLayout` unchanged.

| Scope     | Routes                          | Shell                             | Tokens                                 |
| --------- | ------------------------------- | --------------------------------- | -------------------------------------- |
| Marketing | `/`, `/about`, `/plans`, …      | `PageLayout`                      | Global `:root` brand (cream/navy/gold) |
| Member    | `/login`, `/signup`, `/account` | `MemberLayout` + `GofofaWordmark` | `.member-app` in `styles.css`          |
| Admin ops | `/admin/*`                      | `AdminLayout` (sidebar + topbar)  | `.admin-app` in `styles.css`           |

**Brand split:** Table and Grace on public SEO pages; GOFOFA wordmark + “weekly meals from Table and Grace” on member auth/account. Admin uses neutral slate ops styling (shadcn `Table`, `Card`, `Button` — no consumer `BigButton` / pill marketing patterns).

**Admin IA (stub routes):** Dashboard, Batches, Orders, Kitchen, Customers, Settings — data wiring lands in Phase 3–4.

## Phase 0 — Foundation (this pass)

- [x] Drizzle + MySQL schema scaffold (full domain tables)
- [x] Role enum primitive (`customer` \| `admin`)
- [x] Server-only DB client (`src/db/index.server.ts`)
- [x] SQL migrations in `drizzle/`
- [x] Environment validation module (`src/env.server.ts`) + `.env.example`
- [x] Auth token primitives (`src/auth/` — hashing, session constants)
- [ ] Local MySQL instance + `npm run db:migrate` on developer machines
- [ ] CI job: typecheck + lint (no DB required)

## Phase 1 — Auth & sessions

- [x] Email/password sign-up and login
- [x] Session cookie middleware (TanStack Start server middleware)
- [x] `requireAuth` / `requireRole('admin')` helpers
- [x] Account page wired to real user data (replace mock Margaret Wilson)
- [x] Admin route guard shell
- [x] Admin + member layout shells (see Design shells above)

## Phase 2 — Membership & Stripe

- [ ] Stripe Customer creation on sign-up (`users.stripe_customer_id`)
- [ ] SetupIntent / saved payment method flow
- [ ] Off-session PaymentIntent model for variable weekly totals (not Stripe Subscriptions)
- [ ] Payment schedule on `customer_profiles` (`weekly_autopay` \| `monthly_autopay` \| `manual_per_order`)
- [ ] Webhook handler (`payment_intent.*`)
- [ ] Pause / resume membership

## Weekly fulfillment & payment schedules

Weekly meal fulfillment stays **batch-centric**: one `weekly_orders` row per active member per `weekly_batches` pickup week. Chef assigns lines; customer reviews before charge; kitchen prepares after payment.

| Schedule           | Who sets it                  | Charge trigger                                                                                       | Stripe pattern                                         |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `weekly_autopay`   | Customer (default)           | After `review_deadline` if order is `approved` (auto-approve unchanged draft when `autopay_enabled`) | Off-session `PaymentIntent` per order                  |
| `monthly_autopay`  | Admin for eligible customers | Monthly anchor day (`monthly_billing_day`); sum approved orders in open `billing_cycles`             | One off-session PI per cycle                           |
| `manual_per_order` | Customer default             | Only after explicit “Approve & pay”                                                                  | On-session PI or off-session if card saved + confirmed |

**Profile fields** (`customer_profiles`): `payment_schedule`, `monthly_billing_day`, `payment_schedule_set_by`, `autopay_enabled`, `billing_enabled`.

**Order snapshot** (`weekly_orders`): `payment_schedule_snapshot` and `charge_due_at` frozen at approval; optional `billing_cycle_id` for monthly aggregation.

Totals vary week to week — do **not** use Stripe Subscriptions for MVP.

## Customer review & substitution flow

1. Chef publishes batch → orders move to `pending_customer_review`; notifications sent.
2. Customer opens weekly review (member route, not marketing cart): adjust qty (0 = remove), swap among `batch_items` with remaining inventory, leave comments.
3. Structured requests go to `order_line_requests` (`substitution` \| `zero_out` \| `add`); free-text in `order_comments`.
4. Chef resolves pending requests → order returns to `pending_customer_review` or stays `changes_requested`.
5. Customer approves (manual) or deadline passes (weekly autopay auto-approve) → `approved`, snapshot payment schedule, set `charge_due_at`.
6. Charge job runs → `charging` → `ready_for_pickup` or `payment_failed`.

**Rules:** edits only while batch is open for review and before `review_deadline`; server recalculates totals; substitution beyond inventory → `changes_requested`.

## Cron jobs

Idempotent runs logged in `jobs`; protect HTTP triggers with `CRON_SECRET`.

| Job                      | Trigger               | Purpose                                                         |
| ------------------------ | --------------------- | --------------------------------------------------------------- |
| `batch.publish_review`   | Admin action          | Draft orders → `pending_customer_review`, enqueue notifications |
| `order.auto_approve`     | `review_deadline`     | Weekly autopay + no open change requests → `approved`           |
| `order.charge_weekly`    | `charge_scheduled_at` | Charge `approved` weekly-autopay and manual-approved orders     |
| `billing.charge_monthly` | Monthly anchor        | Aggregate open `billing_cycles`, charge monthly customers       |
| `order.payment_retry`    | Failed PI             | Notify + limited retry window                                   |

Planned routes: `src/routes/api/cron/*`, `src/routes/api/stripe/webhook.ts`.

## Delivery phasing

| Sprint                   | Deliverable                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| **A** (schema + catalog) | Menu catalog tables, pickup windows, payment schedule fields, migrations + seed from `mock-data.ts` |
| **B** (batch + review)   | Admin batch CRUD, chef order generation, customer weekly review UI (qty/substitute/comment)         |
| **C** (manual pay)       | Stripe PM save, manual approve & pay flow                                                           |
| **D** (weekly autopay)   | Auto-approve + weekly charge cron + notifications                                                   |
| **E** (monthly)          | Admin monthly schedule assignment + `billing_cycles` charge job                                     |

## Phase 3 — Weekly batches & catalog

- [ ] `weekly_batches` (chef weekly window: open/close, delivery/pickup dates)
- [x] `plan_categories` / `menu_items` / `pickup_windows` schema
- [x] Seed catalog from `src/lib/mock-data.ts` (`npm run db:seed`)
- [ ] Customer order lines per batch (replace in-memory `order-store`)
- [ ] Batch cutoff enforcement and order confirmation

## Phase 4 — Chef admin & operations

- [ ] Admin dashboard: batch overview, order counts
- [ ] Order/item comments
- [ ] In-app notifications
- [ ] Kitchen PDF export (pick lists, labels)

## Phase 5 — Polish & production

- [ ] Replace remaining mock data (`src/lib/mock-data.ts`)
- [ ] Error monitoring, audit log for admin actions
- [ ] Staging → production migration runbook
- [ ] Load testing for batch cutoff spikes

## Developer commands

```bash
cp .env.example .env          # configure DATABASE_URL, AUTH_SECRET, APP_URL
npm install
npm run env:validate          # check required env vars
npm run db:migrate            # apply migrations (requires MySQL)
npm run db:seed               # idempotent catalog seed (plan_categories, menu_items, pickup_windows)
npm run db:generate           # after schema changes
npm run db:studio             # browse data locally
npm run typecheck && npm run lint && npm run build
```

## Environment variables

Set in Buddy project variables / CloudPanel PM2 env — never commit real values.

| Variable                 | Required | Phase | Purpose                         |
| ------------------------ | -------- | ----- | ------------------------------- |
| `DATABASE_URL`           | yes      | 0     | MySQL connection                |
| `AUTH_SECRET`            | yes      | 0     | Session + magic-link signing    |
| `APP_URL`                | yes      | 0     | Public URL for redirects/emails |
| `STRIPE_SECRET_KEY`      | no       | 2     | Stripe API                      |
| `STRIPE_WEBHOOK_SECRET`  | no       | 2     | Webhook verification            |
| `STRIPE_PUBLISHABLE_KEY` | no       | 2     | Payment Element                 |
| `RESEND_API_KEY`         | no       | 3     | Transactional email             |
| `RESEND_FROM_EMAIL`      | no       | 3     | Sender address                  |
| `TWILIO_ACCOUNT_SID`     | no       | 4     | SMS                             |
| `TWILIO_AUTH_TOKEN`      | no       | 4     | SMS                             |
| `TWILIO_FROM_NUMBER`     | no       | 4     | SMS sender                      |
| `CRON_SECRET`            | no       | 4     | Protect job endpoints           |

See `src/env.server.ts` for Zod validation and `SERVER_ENV_KEYS`.

## Schema layout

```
src/db/
  index.server.ts           # getDb(), closeDb() — import only from server code
  catalog.server.ts         # listPlanCategories, listMenuItems, listPickupWindows, slug lookups
  schema/
    index.ts
    users.ts                # roles, password_hash, stripe_customer_id
    sessions.ts             # auth session tokens
    magic-links.ts          # email magic-link tokens
    customer-profiles.ts    # prefs, billing flags, payment schedule, senior_mode
    memberships.ts          # active / paused / cancelled
    payment-methods.ts      # Stripe PM mirror
    payment-schedules.ts    # shared payment_schedule enums
    plan-categories.ts      # marketing/pricing groups
    menu-items.ts           # catalog meals / add-ons
    pickup-windows.ts       # pickup location/time slots
    weekly-batches.ts       # chef weekly batch + pickup
    batch-items.ts          # cooked inventory per batch
    weekly-orders.ts        # per-customer weekly order + charge snapshot
    order-lines.ts          # assigned line items
    order-line-requests.ts  # customer substitution / qty requests
    order-comments.ts       # customer + internal notes
    billing-cycles.ts       # monthly autopay aggregation
    charges.ts              # Stripe PaymentIntent audit
    notifications.ts        # email/SMS outbox
    jobs.ts                 # idempotent cron runs
    stripe-events.ts        # webhook idempotency
src/env.server.ts           # env validation (Zod)
src/auth/
  index.server.ts           # token hashing, session constants
drizzle/                    # generated SQL migrations
drizzle.config.ts
```

New domain tables should live under `src/db/schema/` and be exported from `schema/index.ts`. Always generate a migration after schema edits.

## Conventions

- **Server-only**: DB, auth, and secrets stay in `*.server.ts` files; never import `@/db/index.server` or `@/env.server` from client components.
- **IDs**: UUID v4 strings (`varchar(36)`) for primary keys.
- **Timestamps**: `created_at` / `updated_at` on mutable entities.
- **Roles**: extend `userRoles` in `users.ts`; migrate enum carefully in MySQL.
- **Secrets**: Buddy / CloudPanel runtime env only — `.env` is gitignored.
