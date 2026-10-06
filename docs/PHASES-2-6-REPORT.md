# Phases 2–6 report — Operations, documents, add-ons, analytics

This report covers everything built after the Phase 1 foundation (see [`PHASE-1-REPORT.md`](PHASE-1-REPORT.md)):

- **Phase 2:** menu, customers, POS, sales, receipts, dashboard, basic reports
- **Phase 3:** quotations, invoices, payments, conversion, printing, document language, audit
- **Phase 4:** inventory, purchases, suppliers, expenses, kitchen display, credit
- **Phase 5:** add-ons
- **Phase 6:** analytics, notifications, i18n

Everything listed here is wired end to end: database, API with permission checks, UI, and translations.
There are no mock endpoints and no placeholder buttons.

## 1. Architecture changes

- **Money is integer minor units everywhere.** Amounts are stored as `bigint` and quantities as `numeric(14,3)`.
  Clients send major units (`12.50`), which are converted once with `toMinor`.
- **One shared, authoritative calculator.** `calculateTotals` in `packages/shared/src/money.ts` handles line
  discounts, an order discount allocated across lines, service charge, inclusive/exclusive tax and per-item
  tax rates. The server uses it to price every POS order, quotation and invoice. The browser uses the same
  code only for live previews; the server recalculates on save.
- **Client-supplied totals, prices, discounts and taxes are never trusted.** POS orders send product IDs,
  quantities and option names. Prices, option surcharges, tax and totals are resolved on the server from the
  database (`priceOrder`, `priceDocument`).
- **One payments ledger.** The single `payments` table has `kind` = sale | credit_payment | invoice | booking.
  A customer's outstanding balance is calculated from sales and invoices, so there is no second ledger that
  could drift.
- **Concurrency-safe numbering.** Receipts, invoices, quotations and purchase orders use the Phase 1
  `allocateDocumentNumber`. Kitchen tickets use a daily, per-outlet sequence.
- **Stock movements** all go through `moveStock`. It takes a row lock on `stock_levels`, applies the negative
  stock policy and writes an `inventory_transactions` row with the balance after the move. Sales (including
  recipe ingredients), voids, purchases, adjustments, wastage, counts and transfers all use it.
- **Add-on architecture.** Add-ons gate permissions (an add-on permission only takes effect while the add-on
  is granted) and gate navigation. Karaoke, reservations, QR menu, online ordering, delivery, loyalty,
  recipes, ingredient costing, advanced inventory and advanced kitchen are implemented.
- **Full-screen operational screens.** POS, the kitchen display and the print preview render outside the
  app shell, but still behind the same business auth gate.

## 2–4. Database, migrations, tables

Migration: `apps/api/drizzle/0001_operations.sql`.

| Area | Tables |
| --- | --- |
| Menu | `categories`, `products` (option groups as JSONB, image, soft delete, unique SKU per business), `recipe_items` |
| Stock | `stock_levels` (per outlet), `inventory_transactions`, `stock_transfers` |
| Customers | `customers` (credit limit/days, loyalty points), `loyalty_transactions` |
| Sales | `sales` (open / completed / void; source pos / online), `sale_items` (name, price, option and cost snapshots), `payments`, `dining_tables`, `kitchen_orders` |
| Documents | `quotations` + `quotation_items`, `invoices` + `invoice_items` (unique `source_quotation_id` prevents double conversion) |
| Purchasing | `suppliers`, `purchases` + `purchase_items`, `expenses` (with attachment) |
| Add-ons | `karaoke_rooms`, `karaoke_bookings`, `reservations` |
| Platform | `notifications` |

Every tenant table carries `business_id`. Child rows use composite `(business_id, id)` foreign keys, so the
database rejects cross-tenant links.

## 5. API routes (all under `/api`, all permission-checked)

| Area | Routes |
| --- | --- |
| Menu | `categories` CRUD, `products` CRUD (+ `image`, `recipe`), `pos/catalog` |
| POS | `pos/quote`, `pos/orders` (create / update / pay), `pos/open-orders` |
| Sales | `sales`, `sales/:id`, `sales/:id/void`, `payments`, `customers/:id/credit-payments` |
| Tables & kitchen | `tables` CRUD, `kitchen/orders` (status, priority) |
| Customers | CRUD, profile, `statement`, `loyalty` |
| Quotations | CRUD, `send` / `accept` / `reject` / `cancel` / `expire`, `convert` |
| Invoices | CRUD, `issue`, `send`, `cancel`, `void`, `payments` |
| Operations | `suppliers`, `purchases` (+ `receive`, `cancel`, `payments`), `expenses` (+ `attachment`), `inventory` (+ `adjust`, `history`, `transfers`) |
| Add-ons | `karaoke/rooms`, `karaoke/bookings` (+ status, payments), `reservations` (+ status), `online-orders` (accept / reject) |
| Analytics | `reports/:type` (14 types, JSON or CSV), `dashboard/sales`, `onboarding` |
| Notifications | `notifications`, `notifications/read` |
| Public (no auth) | `public/menu/:slug`, product images, logo, `POST public/menu/:slug/orders` |

## 6. Backend services

| Service | Responsibility |
| --- | --- |
| `services/ops/sales.ts` | Pricing, open orders with kitchen deltas, completing a sale, voids, FIFO credit payments |
| `services/ops/inventory.ts` | Stock movements, recipe consumption, low-stock notifications |
| `services/ops/customers.ts` | Outstanding balances, customer row locks |
| `services/notifications.ts` | Notifies every user who holds a given permission |

Completing a sale enforces these rules:
- payments must cover the total unless credit is used
- credit needs the credit add-on, a customer, and room under the credit limit
- loyalty points are redeemed and earned
- stock is consumed (recipes included)
- the receipt number is allocated
- all of the above happens in one transaction

## 7. Permissions

87 permissions in total. New ones:
- `payments.view`
- `karaoke.view` / `karaoke.manage`
- `reservations.view` / `reservations.manage`
- `delivery.manage`
- `qr_menu.manage`, `online_orders.manage`
- `loyalty.view` / `loyalty.manage`
- `recipes.view` / `recipes.manage`
- `costing.view`
- `transfers.manage`
- `stations.manage`

The cashier and waiter system roles were extended for POS work. Business admin always holds every permission.

Credit limits and credit days can only be changed by holders of `credit.manage`; the server ignores those
fields from anyone else. CSV export needs `reports.export`, and each report type also needs the permission of
its source module.

## 8–10. Pages, components, modules

| Page | Contents |
| --- | --- |
| Dashboard | Sales widgets ordered by business-type profile (today's sales, orders, average order, dues, low stock, kitchen queue, top items/drinks, recent sales, 14-day trend) and an onboarding checklist |
| POS (`/pos`, full screen) | Category tabs, search, options dialog, held/open orders, tables, delivery, customer, loyalty redemption, split payments, credit, change, receipt printing |
| Kitchen (`/kitchen`, full screen) | Tickets refreshed every 5 s, station filter, rush flag, start / ready / served |
| Sales | Sales list and detail with void; payments ledger tab |
| Menu (`/products`) | Items with option-group editor, photo upload, recipe tab (recipes add-on); categories with kitchen stations |
| Customers | List with balances; profile with stats, history, credit statement, credit payment (FIFO) and loyalty adjustments |
| Quotations / Invoices | List with status filters and outstanding/overdue summary; editor with live preview; detail with every lifecycle action, payments and print |
| Print (`/print/:kind/:id`) | Receipt (58/80 mm or A4), invoice and quotation, rendered in the **document language** with its own direction (`getFixedT`), not the user's UI language |
| Inventory | Levels with stock value, adjust (add / remove / count / wastage), movement history, transfers between outlets |
| Purchases & suppliers | Purchase editor, receive (weighted average cost), supplier payments, supplier balances |
| Expenses | Categories, date filters, totals, receipt attachment (image or PDF) |
| Tables | Floor grid by area with live occupancy |
| Reports | 14 report types, date presets, outlet filter, totals row, CSV export |
| Karaoke | Rooms with hourly rate, server-priced bookings with clash detection, deposits and payments |
| Reservations | Day view, table clash detection, status changes |
| Online orders | Accept (sends a kitchen ticket) or reject; payment is taken from the POS open orders |
| Public menu (`/menu/:slug`) | No login, language switcher, categories, options, cart, order placement (re-priced by the server) |
| Settings | New POS, loyalty and QR menu tabs; the QR code is generated locally |
| Notifications | Top-bar bell with unread count, mark read, deep links |

The navigation is grouped into Operations, Menu & stock, Customers & documents, Finance and Management. Each
item appears only when the plan module, the add-on (if needed) and the user's permission all allow it.

## 11. Translation changes

- 736 new UI strings across 22 namespaces: `pos`, `kitchen`, `sales`, `payments`, `credit`, `products`,
  `customers`, `documents`, `quotations`, `invoices`, `print`, `inventory`, `purchases`, `suppliers`,
  `expenses`, `tables`, `reports`, `karaoke`, `reservations`, `online`, `public_menu`, `notify`, and more.
- Also added: new error and validation codes, and activity-log labels for every new audited action.
- All six languages (en, dv, hi, bn, ne, si) have the full key set with matching placeholders; the shared i18n
  test checks this.
- The four non-Dhivehi translations were machine-produced and need a native-speaker review.
- Numbers and dates use Western digits inside LTR isolates.

## 12. Dhivehi review items

New terms were added to `packages/shared/locales/review/dv.json` (see `docs/TRANSLATION-REVIEW.md`). They are
mostly business and financial vocabulary: credit, outstanding, statement, void, issue, convert, wastage,
loyalty, reservations, karaoke, QR menu. Each item has a suggestion and notes. **Faruma is still missing:**
Faruma font file is required to finalize Dhivehi typography.

## 13–15. Tests

| Suite | Result |
| --- | --- |
| API integration (`npm run test -w @oceanx/api`) | 96 passing |
| Shared (`npm run test -w @oceanx/shared`) | 16 passing |
| Playwright e2e (`npm run e2e`) | 14 passing |

The 96 API tests include 24 operations tests. They cover:
- server pricing
- options validation
- credit-limit enforcement
- FIFO credit payments
- quotation → invoice conversion and double-conversion protection
- invoice overpayment rejection
- purchases and weighted cost
- stock consumption and voids
- report scoping and CSV
- karaoke clash detection
- the public menu
- cross-tenant isolation

The shared tests cover the money calculator and translation completeness/placeholders.

The new e2e spec (`e2e/operations.spec.ts`) covers:
- restaurant registration → menu item → customer
- POS sale (total from the server) → sales list
- quotation → accept → convert → issue → rejected overpayment → payment → printed invoice
- a receipt printed in Dhivehi/RTL while the UI stays English
- a cross-tenant invoice read returning 404

## 16. Responsive checks

- POS has a mobile cart drawer.
- Every list uses the stacked-card table on small screens.
- The kitchen display is a responsive grid.
- The public menu is mobile-first with a sticky cart.
- The Phase 1 mobile/tablet e2e checks still pass with the new navigation.

## 17. Performance checks

- All lists are paginated server-side.
- Dashboard and report queries are aggregated in SQL.
- Supplier and table summaries use correlated subqueries rather than N+1 queries.
- Every new page is lazy-loaded; the POS chunk is about 7 KB gzipped.
- The kitchen display polls every 5 s, online orders every 10 s, notifications every 30 s.

## 18. Remaining issues and known limitations

- **Faruma font file required** before Dhivehi typography is final.
- **Native-speaker review** is needed for dv (review list), hi, bn, ne and si.
- **Customer emails are English only.** Quotation and invoice emails are plain English text and do not
  attach a PDF. Printed documents do use the document language.
- **No server-side PDF.** Documents are printed or saved as PDF from the browser print preview.
- **Recorded payments only.** No card/payment-gateway integration; payments are recorded, not processed.
- **Real-time is polling.** The kitchen display, online orders and notifications poll; there are no websockets.
- **POS needs a connection.** There is no offline mode.
- **Timezone.** Karaoke and reservation times use the browser's local time zone, which is assumed to match
  the business time zone.
- **"Top drinks" heuristic.** The widget matches category names (drink, coffee, tea…, including Dhivehi,
  Hindi and Bengali words).
- **Delivery has no dispatch.** Delivery captures address, phone and fee, but there is no driver
  dispatch/tracking.
- **Three add-ons are not implemented.** Catering, events and guesthouse are in the catalog but inactive.
  They cannot be granted until built.
- **Docker and CI are unverified.** No Docker daemon was available here, so images were not built, and there
  is no CI workflow file.

## 19. Next steps

1. Supply `Faruma.woff2` / `Faruma.ttf` in `apps/web/public/fonts/` and settle the Dhivehi review items.
2. Localised email templates plus server-side PDF attachments for quotations and invoices.
3. Payment gateway integration (card terminals / online payment for QR orders).
4. Push updates (SSE or websockets) for the kitchen display and online orders.
5. Offline-capable POS (queued sales with server reconciliation).
6. Catering, events and guesthouse add-ons; delivery dispatch.
7. CI pipeline and a verified container build.
