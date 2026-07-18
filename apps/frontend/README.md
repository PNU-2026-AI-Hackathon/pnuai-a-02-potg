# Moira Frontend

Next.js App Router frontend for the Moira home screen skeleton.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## Backend API URL

Copy `.env.example` to `.env.local` and set the server-side backend API base URL:

```env
BACKEND_URL=http://localhost:4000
```

Restart the Next.js development server after changing the value. `BACKEND_URL` is
server-only and must not use the `NEXT_PUBLIC_` prefix.

For Vercel or another hosting provider, add `BACKEND_URL` to the project's
environment variables for each required environment (Production, Preview, and
Development), then redeploy. Do not include a trailing slash.

When `BACKEND_URL` is omitted, local development defaults to
`http://localhost:4000`.
