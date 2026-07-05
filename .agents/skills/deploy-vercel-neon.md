# Deploy Vercel + Neon

## Environment

Database access is server-only through Prisma. Runtime code must read
`process.env.DATABASE_URL`; never expose it with a `NEXT_PUBLIC_` prefix.

Local development uses `.env.local`. Vercel uses Project Settings → Environment
Variables for Development, Preview, and Production. Documentation may only use:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
```

## Prisma workflow

For a schema change:

```bash
npm run db:migrate -- --name <migration-name>
npm run typecheck
npm run build
```

Commit `prisma/schema.prisma` and `prisma/migrations/`. Before deploying code that
requires a new schema, apply committed migrations with `npm run db:deploy` against
the target database. Do not run `migrate dev` in Vercel builds.

## Vercel

Use the default Next.js framework preset and `npm run build`. `postinstall` and the
build script generate Prisma Client. Hero assets are static under `public/heroes/`.

Verify after deploy:

- `/` renders the hero catalog.
- `/api/accounts` returns JSON without exposing environment values.
- `#accounts` can create, edit, delete, and import accounts.
- Browser Network/console output contains no database connection string.
