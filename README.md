# Table and Grace

Membership meal-prep ordering site for Table and Grace.

GOFOFA (weekly membership + order batching) backend work is scaffolded on the `staging` branch. See [docs/GOFOFA-PLAN.md](./docs/GOFOFA-PLAN.md) for the phased implementation plan.

## Development

Install dependencies, then run the local Vite dev server.

```bash
npm install
npm run dev
```

### Database (GOFOFA)

MySQL 8+ with Drizzle ORM. Copy the example env file and apply migrations:

```bash
cp .env.example .env
# edit DATABASE_URL
npm run db:migrate
```

Other DB commands: `db:generate` (after schema changes), `db:push` (dev-only sync), `db:studio`.

## Production build

Verify localized assets, then run the production build script.

```bash
npm run build:prod
```

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- MySQL + Drizzle ORM (GOFOFA)
