# Backend for PNUAI PotG

This backend is a minimal Express + TypeScript server that provides API endpoints for the frontend placeholder UI.

## Available APIs

- `GET /api/health`
- `GET /api/summary`
- `GET /api/announcements`
- `GET /api/libraries`
- `GET /api/programs`
- `GET /api/volunteers`
- `GET /api/agenda`
- `GET /api/search?q=...&type=...`
- `POST /api/auth/login`
- `POST /api/auth/register` (mock-only, in-memory; no persistence across restarts)

## Run locally

1. `cd apps/backend`
2. `npm install`
3. Set `DATABASE_URL` and `JWT_SECRET` before starting the server:
   - macOS / Linux: `export DATABASE_URL=postgresql://...`
   - Windows PowerShell: `$env:DATABASE_URL = "postgresql://..."`
   - macOS / Linux: `export JWT_SECRET=your-secret`
   - Windows PowerShell: `$env:JWT_SECRET = "your-secret"`
4. `npm run dev`

The server starts on `http://localhost:4000`.

## Prisma database setup

Run migrations, seed the default interests, and verify the User-Interest relation:

```bash
npx prisma migrate deploy
npm run db:seed
npm run db:verify:interests
```

If a local development database uses a self-signed certificate, set `DATABASE_SSL_REJECT_UNAUTHORIZED=false` before running the seed or verification command.
