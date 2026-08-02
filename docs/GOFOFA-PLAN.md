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

## Phase 0 — Foundation (this pass)

- [x] Drizzle + MySQL schema scaffold (`users`, `sessions`)
- [x] Role enum primitive (`customer` \| `admin`)
- [x] Server-only DB client (`src/db/index.server.ts`)
- [x] Initial SQL migration in `drizzle/`
- [x] Environment variable documentation (`.env.example`)
- [ ] Local MySQL instance + `npm run db:migrate` on developer machines
- [ ] CI job: typecheck + lint (no DB required)

## Phase 1 — Auth & sessions

- [ ] Email/password or magic-link sign-up and login
- [ ] Session cookie middleware (TanStack Start server middleware)
- [ ] `requireAuth` / `requireRole('admin')` helpers
- [ ] Account page wired to real user data (replace mock Margaret Wilson)
- [ ] Admin route guard shell

## Phase 2 — Membership & Stripe

- [ ] Stripe Customer creation on sign-up (`users.stripe_customer_id`)
- [ ] SetupIntent / saved payment method flow
- [ ] Subscription or off-session PaymentIntent model for weekly variable totals
- [ ] Webhook handler (`customer.subscription.*`, `payment_intent.*`)
- [ ] Pause / resume membership

## Phase 3 — Weekly batches & catalog

- [ ] `batches` (chef weekly window: open/close, delivery/pickup dates)
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
cp .env.example .env          # configure DATABASE_URL
npm install
npm run db:migrate            # apply migrations (requires MySQL)
npm run db:generate           # after schema changes
npm run db:studio             # browse data locally
npm run typecheck && npm run lint && npm run build
```

## Schema layout

```
src/db/
  index.server.ts       # getDb(), closeDb() — import only from server code
  schema/
    index.ts
    users.ts            # roles, stripe_customer_id
    sessions.ts         # auth session tokens
drizzle/                # generated SQL migrations
drizzle.config.ts
```

New domain tables should live under `src/db/schema/` and be exported from `schema/index.ts`. Always generate a migration after schema edits.

## Conventions

- **Server-only**: DB and secrets stay in `*.server.ts` files; never import `@/db/index.server` from client components.
- **IDs**: UUID v4 strings (`varchar(36)`) for primary keys.
- **Timestamps**: `created_at` / `updated_at` on mutable entities.
- **Roles**: extend `userRoles` in `users.ts`; migrate enum carefully in MySQL.
