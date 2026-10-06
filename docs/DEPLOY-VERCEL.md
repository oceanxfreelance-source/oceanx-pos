# Deploying to Vercel + Neon (demo / small installs)

The repository builds for Vercel with the Build Output API (`scripts/build-vercel.mjs`, configured in
`vercel.json`):

- the React app is served as static files;
- the Fastify API runs as one Node.js function at `/api/*` (`apps/api/src/serverless.ts`).

## Environment variables

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string (`…-pooler…`, `sslmode=require`) |
| `MIGRATION_DATABASE_URL` | Neon **direct** connection string (same, without `-pooler`), used for migrations |
| `AUTO_MIGRATE` | `true` — apply migrations and sync reference data on cold start (advisory-locked, idempotent) |
| `NODE_ENV` | `production` |
| `APP_URL` | public URL, e.g. `https://your-project.vercel.app` |
| `APP_ENCRYPTION_KEY` | 32 random bytes, base64 (`openssl rand -base64 32`) |
| `COOKIE_SECURE` | `true` |
| `TRUST_PROXY` | `1` |
| `MAIL_TRANSPORT` / `SMTP_URL` / `MAIL_FROM` | SMTP settings. For a demo without SMTP: `MAIL_TRANSPORT=log` + `ALLOW_LOG_MAIL=true` (emails only appear in function logs) |
| `STORAGE_DIR` | `/tmp/oceanx-storage` |
| `BOOTSTRAP_SUPERADMIN_EMAIL` / `BOOTSTRAP_SUPERADMIN_PASSWORD` | Optional: creates the first Super Admin only if none exists. Remove after first sign-in. |

## Limitations on serverless

- **Uploaded files are temporary.** Logos, product photos and expense attachments are written to the
  function's `/tmp` and disappear when the instance is recycled. Use the Docker/VM deployment (persistent
  volume) for production, or add object storage.
- **Rate limits are per instance.** Login rate limits are kept in each function instance's memory, so they
  are not shared across instances.
