# Phase 1 report — Platform foundation

## 0. Starting point

The repository was empty: no commits, no code, no fonts. There was nothing to reuse or keep compatible with,
so the architecture below was chosen fresh. It is a TypeScript monorepo with a Fastify API, PostgreSQL via
Drizzle, and a React SPA.

## 1. Architecture changes

- npm workspaces monorepo: `apps/api`, `apps/web`, `packages/shared`.
- `packages/shared` is the single source of truth for permissions, modules, add-ons, business types,
  languages, settings schemas, request schemas, error codes and translations. API and web both use it.
- Two isolated authentication domains (business users vs Super Admin): separate routes, cookies, session
  tables, guards and React auth contexts.
- Layered API:
  - guards: authentication, tenant resolution, CSRF
  - `requirePermission` for authorization
  - Zod `parse()` for validation
  - services: business logic and DB access, always tenant-scoped
  - routes
- Access evaluation = business status + subscription + plan modules/limits + granted add-ons + role permissions.
- Business type affects only defaults, terminology and dashboard widget profile (`businessTypes.ts`).

## 2–4. Database, migrations, tables

Migration: `apps/api/drizzle/0000_init.sql`. It is applied by `npm run db:migrate`, which also syncs
reference data idempotently.

| Area | Tables |
| --- | --- |
| Super Admin domain | `super_admins`, `super_admin_sessions`, `super_admin_tokens`, `platform_settings`, `platform_languages` |
| Catalog | `plans` (limits JSON, module list), `addons` |
| Tenants | `businesses`, `subscriptions`, `business_addons`, `outlets`, `business_settings` |
| Business users / RBAC | `users`, `user_sessions`, `user_tokens`, `permissions` (catalog mirror), `roles`, `role_permissions`, `user_roles`, `user_outlets` |
| Platform services | `document_sequences`, `activity_logs` |

Integrity rules:
- Composite tenant foreign keys `(business_id, id)`: `user_roles` → users/roles, `user_outlets` → users/outlets,
  `user_sessions` → users/outlets, `users.default_outlet_id` → outlets.
- Case-insensitive unique emails. The business-user index is partial and excludes soft-deleted users.
- Per-business unique role and outlet names.
- Indexes for status, type, period end and audit queries.

Reference data (not demo data): 72 permissions, 6 languages, 15 add-on registry entries, and 5 default plans
(Trial, Basic, Pro, Business, Custom). Plans are inserted only if missing, so Super Admin edits are kept.

## 5. API routes

**Business** (`/api`, BusinessUserGuard except the public auth routes):

| Area | Routes |
| --- | --- |
| Public | `GET /languages` · `POST /auth/login` · `POST /auth/register` · `POST /auth/forgot-password` · `POST /auth/reset-password` (also accepts invites) |
| Session | `GET /auth/session` · `POST /auth/logout` · `POST /auth/change-password` · `PATCH /me/preferences` · `POST /me/outlet` |
| Users | `GET/POST /users` · `GET/PATCH/DELETE /users/:id` · `POST /users/:id/password` |
| Roles | `GET/POST /roles` · `GET/PUT/DELETE /roles/:id` · `GET /permissions` |
| Settings | `GET /settings` · `PATCH /settings/profile` · `PATCH /settings/:section` (regional, tax, receipt, invoice, quotation) · `PUT/GET /settings/logo` |
| Other | `GET/POST /outlets` · `PATCH /outlets/:id` · `GET /addons` · `GET /dashboard` · `GET /activity-logs` |

**Super Admin** (`/api/superadmin`, SuperAdminGuard except the public auth routes):

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/login`, `/auth/mfa`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password` · `GET /auth/session` |
| Security | `POST /security/2fa/setup`, `/2fa/enable`, `/2fa/disable` · `GET /security/sessions` · `DELETE /security/sessions/:id` |
| Businesses | `GET/POST /businesses` · `GET/PATCH /businesses/:id` · `POST /businesses/:id/{approve,activate,suspend,deactivate}` |
| Subscriptions | `POST /businesses/:id/subscription/{change-plan,extend}` · `GET /subscriptions` |
| Add-on grants | `POST /businesses/:id/addons/:code/{grant,revoke}` · `POST /businesses/:id/owner/resend-invite` |
| Catalog | `GET/POST /plans` · `PUT /plans/:id` · `GET/POST /addons` · `PUT /addons/:id` |
| Platform | `GET /dashboard` · `GET /languages` · `PATCH /languages/:code` · `GET/PATCH /settings` · `GET /activity-logs` |
| Users | `GET /users/business` (read-only) · `GET/POST /users/admins` · `PATCH /users/admins/:id` |

## 6. Backend services

| Service | File | Responsibility |
| --- | --- | --- |
| access | `services/access.ts` | Business status, effective subscription, modules, add-ons, limits, effective permissions |
| provisioning | `services/provisioning.ts` | Creates a whole tenant in one transaction: business, subscription, main outlet, settings, 6 system roles, owner |
| users / roles | `services/users.ts`, `services/roles.ts` | Tenant-scoped CRUD with escalation guards, plan limits (advisory lock against races) and audit |
| settings | `services/settings.ts` | Validated JSON settings sections |
| sequences | `services/sequences.ts` | Concurrency-safe document numbers |
| tokens | `services/tokens.ts` | Single-use hashed reset/invite tokens |
| platformSettings | `services/platformSettings.ts` | Platform-wide settings |

Supporting libraries in `lib/`: `audit` (secret scrubbing), `crypto` (hashing, AES-GCM), `password`
(Argon2id), `storage` (magic-byte image validation), `mailer` (SMTP / log / memory).

## 7. Permissions

There are 72 granular permissions in `packages/shared/src/permissions.ts`. Each is mapped to a module and,
where relevant, an add-on (`credit.*` → credit, `outlets.*` → multi_outlet).

System role templates:

| Role | Permissions |
| --- | --- |
| Business Admin | All; protected |
| Manager | All except user deletion, role management, settings management, add-on configuration and outlet management |
| Salesperson | Dashboard, customers, quotations, invoices |
| Cashier | POS, sales, customers, invoice payments |
| Kitchen Staff | Dashboard, kitchen |
| Waiter | POS, sales, tables, kitchen view, customers |

Custom roles are supported.

## 8–10. Pages, components, modules

Business pages:
- Login, Register, Forgot password, Reset password / accept invite
- Dashboard (widgets gated by permission)
- Users (list, search, pagination, create/edit, set password, delete)
- Roles (permission matrix greyed by plan, add-on and grantability)
- Settings (profile + logo, regional, tax & service charge, receipts, invoices, quotations, numbering with live preview)
- Outlets (multi-outlet add-on), Add-ons, Activity log, My account (language, theme, reduce animations, password)
- Status screens (pending, suspended, expired, forced password change)

Super Admin pages:
- Login with 2FA step, Forgot / Reset password
- Dashboard (real metrics, 30-day registrations chart, add-on usage)
- Businesses / Restaurants / Cafés (filters), business detail (approve, activate, suspend with reason,
  deactivate, change plan, extend, grant/revoke add-ons, resend owner invite)
- Plans editor (limits, modules), Add-on catalog, Subscriptions
- Users (Super Admins plus a read-only directory of business users), Languages, Settings, Activity logs
- Security (TOTP setup with QR code, sessions, password)

Components: responsive shell (sidebar → drawer), Button, Input/Select/Textarea/Switch/Checkbox, Card,
StatCard, Badge, Alert, EmptyState, Skeleton, Dialog/ConfirmDialog, DataTable (stacked cards on mobile),
Pagination, Tabs, Dropdown, LanguageMenu, FarumaWarning.

## 11. Translation changes

- Six complete locales (en, dv, hi, bn, ne, si), 764 keys each. Placeholder parity is verified by test.
- API errors are codes, translated as `errors.<code>`. Field validation is translated as `validation.<code>`
  with parameters.
- Western digits are used in every language. Dates for locales without browser data (Dhivehi) are numeric
  and LTR-isolated. Relative time comes from translation keys.
- Document language is a business setting, with per-document-type overrides. It is independent of each
  user's UI language.

## 12. Dhivehi review items

There are 33 tracked items: 26 `needs_review`, 7 `confirmed`. See `docs/TRANSLATION-REVIEW.md`.

Key decisions needed from you:
1. **Invoice:** އިންވޮއިސް or ބިލު?
2. **Quotation:** ކޮޓޭޝަން or އަގު ހުށަހެޅުން?
3. **Outlet:** އައުޓްލެޓް or ބްރާންޗު?
4. **Credit / Customer Due terminology:** ދަރަނި vs ކްރެޑިޓް. Needed before Phase 4.
5. **Time-of-day greetings:** keep them, or always use އައްސަލާމު ޢަލައިކުމް?

Missing translations:

| Language | Missing |
| --- | --- |
| English | 0 |
| Dhivehi | 0 (26 strings flagged for review) |
| Hindi | 0 |
| Bengali | 0 |
| Nepali | 0 |
| Sinhala | 0 |

Hindi, Bengali, Nepali and Sinhala still need a native-speaker review before launch.

**Faruma font: not present in the project.** *Faruma font file is required to finalize Dhivehi typography.*
The loading code, RTL layout and missing-font detection are in place. No substitute font is bundled.

## 13–15. Tests (all passing at the end of Phase 1)

| Suite | Count | Covers |
| --- | --- | --- |
| API integration (`apps/api/test`, real PostgreSQL) | 72 | auth (both domains), sessions, CSRF, lockout, rate limits, reset, 2FA/replay, domain isolation, RBAC, escalation, plan modules/limits/races, add-on gating, tenant isolation, Super Admin lifecycle/dashboard/catalog/settings, numbering concurrency, settings and logo validation, per-user language |
| Translations (`packages/shared/test`) | 8 | catalog-driven keys, parity and placeholders for all 6 languages, Thaana coverage, review-list integrity |
| End-to-end (Playwright, `apps/web/e2e`) | 9 | no SA link on login, registration → permission-driven nav, Dhivehi RTL + Faruma warning + no English leakage, cashier sees restricted nav and API returns 403, business user blocked from the SA console, SA flow + add-on grant reflected in tenant nav, mobile and tablet layouts |

**Security tests** (in the API suite):
- forged tokens and cross-domain cookies
- missing or forged CSRF tokens
- privilege escalation via roles, assignment, self-edit, or editing the owner or more-privileged users
- unknown permission keys
- client-supplied `business_id`, `outlet_id` and `isOwner` are ignored
- malformed IDs return 404
- fake image uploads are rejected
- hashed-token storage

**Tenant isolation tests:**
- list endpoints return only the caller's tenant
- IDOR on users and roles (GET/PATCH/DELETE/password) returns 404 and nothing changes
- cross-tenant role and outlet assignment is rejected
- outlet switching into another tenant fails
- settings and dashboard data are scoped
- file access is scoped to the caller's own business
- unauthenticated access is denied

## 16. Responsive checks

Playwright verifies these at 390×844 (mobile) and 820×1180 (tablet):
- the sidebar becomes a drawer, and the drawer closes after navigation
- there is no horizontal scroll
- tables render as stacked cards on mobile

Desktop and RTL layouts were checked with screenshots.

## 17. Performance checks

- Every list is paginated and limited server-side (max 100).
- List queries avoid N+1: roles for a page of users come from one query, as do user counts per business.
- Indexes back status, type, period-end and audit-time queries.
- Session `last_seen` is written at most once per minute.
- Non-English locales and all pages are code-split; Dhivehi is about 12 KB gzipped.
- The concurrency test allocates 100 document numbers in parallel without duplicates.

## 18. Remaining issues and known limitations

- **Faruma font file required** (see §12).
- Dhivehi review items need your decisions; the other four languages need a native-speaker review.
- **Docker images were not built in this environment** (no Docker daemon). The Dockerfile and compose file are
  written but unverified. The production bundle (`tsup`) and its migration runner were verified with Node directly.
- The session check runs about 4 small queries per request. A short-TTL cache (e.g. Redis) is an option at scale.
- PostgreSQL row-level security as a second isolation layer is not enabled yet. Isolation is enforced in the
  service layer and by composite foreign keys.
- No CI workflow file was added. Pushing `.github/workflows` may need extra token scope; the commands are in the README.
- The onboarding wizard is deferred to Phase 2. It depends on categories, products, tax and receipts.
- Email delivery uses SMTP. Notification templates are plain text and English-only for now.

## 19. Next phase — Phase 2 (core restaurant/café)

1. Categories and products/menu (variants and modifiers architecture, images, plan `max_products` limit).
2. Customers.
3. POS: fast cart, server-side totals, tax and service charge from settings, payments, receipt numbering via
   `allocateDocumentNumber`, printable receipts in the document language.
4. Sales list, receipts and voids, with audit.
5. Dashboard sales widgets per business-type profile, plus basic reports.
6. Onboarding wizard.
