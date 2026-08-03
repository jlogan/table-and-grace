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
- [ ] Subscription or off-session PaymentIntent model for weekly variable totals
- [ ] Webhook handler (`customer.subscription.*`, `payment_intent.*`)
- [ ] Pause / resume membership

## Phase 3 — Weekly batches & catalog

- [ ] `weekly_batches` (chef weekly window: open/close, delivery/pickup dates)
- [ ] `menu_items` / plan categories linked to batches
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
  schema/
    index.ts
    users.ts                # roles, password_hash, stripe_customer_id
    sessions.ts             # auth session tokens
    magic-links.ts          # email magic-link tokens
    customer-profiles.ts    # prefs, billing flags, senior_mode
    memberships.ts          # active / paused / cancelled
    payment-methods.ts      # Stripe PM mirror
    weekly-batches.ts       # chef weekly batch + pickup
    batch-items.ts          # cooked inventory per batch
    weekly-orders.ts        # per-customer weekly order
    order-lines.ts          # assigned line items
    order-comments.ts       # customer + internal notes
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
