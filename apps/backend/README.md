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
- `POST /api/auth/register`
- `GET /api/auth/me` (requires JWT)
- `GET /api/interests`
- `GET /api/interests/me` (requires JWT)
- `PUT /api/interests/me` (requires JWT)
- `POST /api/interests/me` (requires JWT)

## Authentication and authorization

JWT authentication uses the `Authorization: Bearer <token>` header. The backend verifies the token, loads the current user from the database, and attaches the authenticated user to `req.user`.

User roles are based on `User.accountType`:

- `RESIDENT`: regular user
- `LIBRARIAN`: librarian
- `ADMIN`: administrator

Protected API policy:

- `GET /api/auth/me`: authenticated users
- `GET /api/interests/me`: authenticated users
- `PUT /api/interests/me`: authenticated users
- `POST /api/interests/me`: authenticated users
- `GET /api/interests/users/:userId`: librarians and admins
- `PUT /api/interests/users/:userId`: librarians and admins
- `POST /api/interests/users/:userId`: librarians and admins

Authentication errors use HTTP `401` with:

```json
{ "code": "AUTHENTICATION_REQUIRED", "error": "Authentication required." }
```

Authorization errors use HTTP `403` with:

```json
{ "code": "FORBIDDEN", "error": "You do not have permission to access this resource." }
```

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

## HWP attachment extraction

HWP extraction requires Node.js 18 or newer; Node.js 22 is recommended. `kordoc 4.2.7` runs as one isolated subprocess per file with a default 60-second timeout and concurrency 1.

```bash
# Read-only extraction validation
npm run extract:program-attachments -- --type HWP --attachment-id <uuid> --dry-run

# Claim and persist one eligible HWP attachment
npm run extract:program-attachments -- --type HWP --attachment-id <uuid>
```

The kordoc OCR/PDF optional dependencies are not used by the HWP path. A kordoc-only runtime can use `npm ci --omit=dev --omit=optional`. Do not apply `--omit=optional` blindly to this whole backend: the existing direct `sharp` dependency needs its platform-specific optional runtime for image OCR. An EC2 deployment must either preserve the matching sharp runtime or isolate the HWP worker install. If an old `node_modules` contains kordoc OCR/PDF packages, replace it with a clean, lockfile-based production install after deciding that packaging boundary.

Ubuntu 24.04 execution has not yet been verified. Do not process all HWP attachments in production until the representative samples, timeout/kill behavior, peak memory, sharp packaging, and temporary-file cleanup pass in that environment.
