# OceanX — Restaurant & Café Management SaaS

Multi-tenant platform for restaurants, cafés, coffee shops, bakeries, fast food, juice and dessert shops,
takeaways and other food businesses. One codebase and one data model; the business type only changes
defaults, terminology and suggestions.

> **Status: Phases 1–6 are implemented.** That covers the platform foundation, menu, POS, sales, kitchen
> display, customers and credit, quotations and invoices (with conversion and printing in the document
> language), inventory, purchases, suppliers, expenses, add-ons (karaoke, reservations, QR menu, online ordering,
> loyalty, recipes and costing, transfers), reports, notifications and six languages.
> See [`docs/PHASE-1-REPORT.md`](docs/PHASE-1-REPORT.md) and [`docs/PHASES-2-6-REPORT.md`](docs/PHASES-2-6-REPORT.md)
> for details and the known limitations.

## Stack

| Layer | Choice |
| --- | --- |
| API | Node 22, Fastify 5, TypeScript, Zod validation |
| Database | PostgreSQL 16, Drizzle ORM + SQL migrations (`apps/api/drizzle`) |
| Web | React 19, Vite, Tailwind CSS 4, TanStack Query, react-i18next |
| Shared | `packages/shared` — permission catalog, modules/add-ons, business types, languages, settings & request schemas, locales |
| Tests | Vitest integration tests against real PostgreSQL; Playwright end-to-end tests |

```
apps/api          Fastify API (business + super admin domains)
apps/web          React SPA (business app at /, super admin console at /superadmin)
packages/shared   Code + translations shared by API and web
deploy/           nginx config for the web image
docs/             Phase reports, translation review
```

## Architecture in one page

**Two isolated security domains**

| | Business users | Super Admin |
| --- | --- | --- |
| Login | `/login` | `/superadmin/login` (never linked from `/login`) |
| API | `/api/*` | `/api/superadmin/*` |
| Cookie | `ox_session` (path `/api`, SameSite=Lax) | `ox_sa_session` (path `/api/superadmin`, SameSite=Strict) |
| Sessions | `user_sessions` | `super_admin_sessions` |
| Guard | `BusinessUserGuard` (`guards/business.ts`) | `SuperAdminGuard` (`guards/superadmin.ts`) |

Each guard reads only its own cookie and table, so a token from one domain can't authenticate in the other.
Session tokens are random 256-bit values stored only as SHA-256 hashes. Sessions have idle and absolute
expiry, and mutating requests require a per-session CSRF token. Passwords use Argon2id. Logins have lockout
and per-IP rate limits. Password resets and invitations use single-use hashed tokens. Super Admins can enable
TOTP 2FA: the secret is AES-256-GCM encrypted at rest, codes can't be replayed, and the session is rotated
after the second factor.

**Tenant isolation.** The tenant (`business_id`) and working outlet (`outlet_id`) are resolved from the
server-side session, never from client input. Every service query is scoped by the session's business, and
request schemas never accept `business_id` or `outlet_id` (unknown keys are stripped). Composite foreign keys
(`(business_id, id)`) on user↔role, user↔outlet and session↔outlet links mean the database itself rejects
cross-tenant references. Files are resolved through the owning business row, never through a client-supplied
path.

**Access = subscription + plan + add-ons + permissions.** `services/access.ts` evaluates the following on every request:
- business status (pending / active / suspended / deactivated)
- effective subscription status (trial / active / expired)
- plan modules and limits (stored in the DB, editable by Super Admin)
- granted add-ons

Role permissions only take effect if their module is in the plan and any required add-on is granted.
Enforcement is server-side (`requirePermission`). Non-owners can only grant permissions they hold themselves,
which prevents privilege escalation.

**Document numbering** (`services/sequences.ts`) allocates numbers with one atomic
`INSERT … ON CONFLICT DO UPDATE … RETURNING` per business, scope (business or outlet), document type and
period. It is safe under concurrency (tested with 100 parallel allocations), the format is configurable
(`{PREFIX}-{YYYY}-{SEQ}` → `INV-2026-00001`), and numbers roll back with the transaction.

## Languages, RTL and Faruma

The UI is fully translated into English, Dhivehi (`dv`, RTL), Hindi, Bengali, Nepali and Sinhala (764 keys
each). Language is stored **per user**, and document language is a separate business setting. Locales live in
`packages/shared/locales`. `npm run i18n:check` reports missing keys, placeholder mismatches and the Dhivehi
review list. Non-English locales are code-split and loaded on demand.

**Faruma font.** Faruma is bundled at `apps/web/public/fonts/Faruma.woff2` (with the original `.ttf` as a
fallback) and is the only font used for Thaana text. No other Thaana font is substituted: if Faruma ever fails
to load, Dhivehi pages show a visible warning: *"Faruma font file is required to finalize Dhivehi typography."*

Dhivehi wording that needs a native/business decision is tracked in
[`docs/TRANSLATION-REVIEW.md`](docs/TRANSLATION-REVIEW.md) (source: `packages/shared/locales/review/dv.json`).

## Local development

Requirements: Node 20+, PostgreSQL 14+.

```bash
npm install
createdb oceanx_dev && createdb oceanx_test
cp apps/api/.env.example apps/api/.env      # set DATABASE_URL and APP_ENCRYPTION_KEY
npm run db:migrate                           # migrations + reference data (permissions, languages, plans, add-ons)
npm run superadmin:create -- --email you@example.com --name "Your Name"   # prompts for a password (min 12)
npm run dev:api                              # http://localhost:4000
npm run dev:web                              # http://localhost:5173  (proxies /api)
```

There are no default credentials and no demo tenants. Create businesses from the Super Admin console, or
self-register at `/register` (Super Admin → Settings → Self-registration: open / requires approval / closed).
**Money and pricing.** Amounts are integer minor units. The server prices every POS order, quotation, invoice,
booking and public QR-menu order from database prices with the shared `calculateTotals` (discount allocation,
service charge, inclusive/exclusive tax). Client totals are never trusted. All money received is recorded in a
single `payments` ledger, and customer balances are calculated from it.

**Public QR menu.** `/menu/:slug` needs no login and only shows what the business publishes (QR-menu add-on +
setting). Orders placed there are re-priced on the server and arrive under *Online orders* for staff to accept.

In development, emails (invitations, password resets) are printed to the API log (`MAIL_TRANSPORT=log`).

## Tests

```bash
npm run test -w @oceanx/api       # API integration tests (needs PostgreSQL; TEST_DATABASE_URL, default oceanx_test)
npm run test -w @oceanx/shared    # translation completeness
npm run i18n:check                # human-readable translation report
npm run e2e                       # Playwright (needs PostgreSQL db oceanx_e2e; starts API + web itself)
```

## Deployment

`Dockerfile` builds two images: `api` (Node) and `web` (nginx serving the SPA and proxying `/api`).
`docker-compose.yml` wires them to PostgreSQL. Production requires `APP_ENCRYPTION_KEY`, `COOKIE_SECURE=true`
(serve over HTTPS) and `MAIL_TRANSPORT=smtp`; the API refuses to start without them. Run migrations as a
one-off job before starting new versions (`node dist/db/migrate.js`).
