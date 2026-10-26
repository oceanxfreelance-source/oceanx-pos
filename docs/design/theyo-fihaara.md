# Theyo Fihaara (ތެޔޮ ފިހާރަ) — product design

Fuel shed management for island fuel sheds. By OceanX. Status: design (not built).
Related: plan `docs/ideas/fuel-pos.md` · demo screens `docs/marketing/fuel-demo/` · logo `docs/marketing/fuel-demo/logo/`.

---

## 1. What it is

A PC-first system (phone for the owner) that runs a fuel shed: selling fuel and shop items, checking
pump meters against cash, tank stock and losses, credit customers (boats, companies, councils),
quotations and invoices for government, expenses and profit.

**Customers:** private and council-run island sheds, harbour fuel sellers, companies with their own fuel.
**Not (yet):** FSM, Hawks (they have enterprise systems).

## 2. How it ships

- A new product **`fuel`** next to `pos`, `gravity`, `flow`, `budget`: own sign-up, sign-in, address
  **`theyo.oceanx.app`**, plan and Super Admin console.
- **Same backend as OceanX POS.** Fuel adds tables and screens; it reuses sales, customers, cash closing,
  quotations, invoices, payments, suppliers, purchases, expenses, products, staff, roles, billing, languages,
  offline, printing.
- Languages: English, Dhivehi (RTL), Bengali, Hindi, Nepali, Sinhala — per user.

## 3. Setup decides the screens

Set in onboarding and **Settings**; screens hide what a shed doesn't use.

| Setting | Options | Effect |
|---|---|---|
| Working mode | One person, no shifts · Shifts with staff | Day close vs shift close; staff names on sales |
| Dispensers / nozzles | 1…n, each nozzle → product + tank | 1 nozzle: no pump choice at the till |
| Meter | Working meter · No meter | No meter: litres typed per sale; checks use stock instead of meters |
| Storage | Tanks · Drums · Both | Dip in cm (tank chart) or drum count |
| Products | Petrol, Diesel (+ others) | Prices, price lists |
| Credit | On · Off | Credit customers, statements, reminders |
| Quotations & invoices | On · Off | For government / big customers |
| Printing | Off (default) · Receipt printer · A4 | Print buttons show only when a printer is set up; digital receipts and PDFs always available |
| Tolerances | Cash (e.g. MVR 100), tank variance (e.g. 1%), quick-add credit limit (e.g. MVR 500) | Alerts and approvals |

## 4. Sidebar (full; items hide by setup)

- **Operations:** Overview · Point of sale · Shifts *(or Day close)* · Tanks & dips · Deliveries · Expenses
- **Customers:** Credit customers · Quotations & invoices · Price lists
- **Shop:** Shop items
- **Insights:** Reports
- **Settings**

## 5. Core flows

### 5.1 Sell (till)
1. (If >1 nozzle) pick nozzle → product and price come from it.
2. Enter **litres** or **amount** (quick 5/10/20/50 L) or "Fill tank".
3. Optional shop items.
4. **Customer:** *Walk-in* (default) · *Credit customer* (search name / phone / boat-vehicle no.) · *+ New customer* (name required, phone & vehicle optional).
5. **Payment:**
   - Walk-in: Cash · Card · QR / transfer (paid now).
   - Credit customer: **On credit** (checked against limit; owner approval above it) or pay now.
6. Save. **Printing is optional**: print a receipt (if a printer is set up), send it digitally (Viber / SMS / share as PDF), or no receipt.
- Price used = the customer's **price list** price at that moment.
- Credit customer with an **approved quotation**: the sale links to it; till warns near the approved litres.
- Offline: sales queue on the device and sync later (same as Budget).

### 5.2 Shift close / day close
1. Closing **meter reading** per nozzle (opening = last closing).
2. System: litres per nozzle × price (handles price changes inside the period) → expected fuel sales; + shop items.
3. Minus by method: on credit, transfer (verified), card, QR, expenses paid from cash.
4. **Cash expected** → enter **cash counted** (optional denominations) → over / short.
5. Above tolerance → note required; owner notified.
6. Print shift slip / A4 report.
- No-meter sheds: litres come from sales; the check is stock-based (dip/drums).
- Day close can be skipped; next close covers the whole period.

### 5.3 Tanks & dips
- Record dip (cm) per tank → litres via the tank's **calibration chart** (table of cm → L; interpolate).
- **Book stock** = last dip-confirmed stock + deliveries − sales since.
- Variance = measured − book; % of book; alert above tolerance; daily trend chart.
- Drums: full drums × drum size + litres in the open drum.

### 5.4 Deliveries
- Supplier, product, tank, invoiced litres, cost, delivery note photo.
- Dip **before** and **after** → received litres → difference vs invoiced (allowance setting).
- Updates tank book stock and **average cost per litre** (for profit).

### 5.5 Credit customers
- Kinds: person · company · government (exists in `customers.kind`).
- Fields: name, phone, Viber, boat/vehicle numbers (many), credit limit, credit days (e.g. 15), price list,
  "needs quotation & invoice".
- Balance, ageing (current / 16–30 / 31–60 / 60+), statement PDF, **record payment** (cash, transfer + slip, cheque),
  part payments, prepaid balance (top-up first, deduct on sale).
- Reminders (Viber / SMS) on due date and after; owner chooses timing.
- Quick-added customers (from the till) are flagged "new" with who added them.

### 5.6 Quotations & invoices (government / big customers)
- Quotation: litres × price per product, delivery charge, validity, terms → Sent → **Approved** (+ PO / approval no.).
- Fuel taken goes **on credit** and links to the quotation (used vs approved litres).
- Invoice: one click from the quotation, or **monthly** from all fills; lists each fill (date, vehicle/boat,
  litres, price), PO no., bank details; delivery notes attached. PDF English / Dhivehi.
- Status: Unpaid → Part paid → Paid; appears in the customer's balance and ageing.

### 5.7 Expenses
- From the till (petty cash): amount, category, note, bill photo → deducted in the next close; staff limit.
- Office expenses: salaries, utilities, rent & licences, maintenance, generator/transport, bank charges; paid
  by cash / transfer / card; repeat monthly.
- Fuel purchases are **not** expenses (they are Deliveries).

### 5.8 Prices
- Price lists: Retail, Fishing vessels, Bulk fishing, Companies, Council (custom).
- **Scheduled price change** with an effective date-time; sales keep their price; an open shift is split
  at the change; staff reminded beforehand; full history.

## 6. Screens (summary)

| Screen | Main content | Key actions |
|---|---|---|
| Overview | Revenue, litres by product, credit issued, receivables, litres by hour (+ forecast), alerts, recent sales, tank levels | New sale, export |
| Point of sale | Nozzles (status), litres/amount keypad, customer, payment, total | Complete sale, + New customer, Expense |
| Shifts / Day close | List with over/short; close screen with readings and reconciliation | Close, save draft, print |
| Tanks & dips | Levels, dip check, variance trend | Record dip, calibration charts |
| Deliveries | List, record with dip before/after | Record delivery, attach photo |
| Expenses | Petty cash + office, by category, cost per litre | New expense |
| Credit customers | KPIs, tabs (overdue, fishing, companies, government, prepaid), table with limit/balance/due | New customer, record payment, statements, reminders |
| Quotations & invoices | Lists with status, used vs approved | New quotation, invoice from quotation, monthly invoices |
| Price lists | Current prices, scheduled change, history | Schedule change, new list |
| Shop items | Items, stock, reorder | New item, stock count, import |
| Reports | Daily summary, shift, tank variance, receivables ageing, statements, profit & loss, deliveries & cost, shop items, GST | PDF / Excel / print |
| Settings | Shed, nozzles & tanks, working mode, staff & roles, tolerances, payments, receipts, taxes, languages, billing | — |
| Owner phone | Sales today, shifts, tanks, receivables, alerts | — |

Demo pictures for all of these: `docs/marketing/fuel-demo/tabs/`, Dhivehi in `.../dhivehi/`, reports in `.../reports/`.

## 7. Data model

**Reused (existing):** businesses, outlets (= sheds), users/roles/permissions, customers (+kind, limit, days, Viber),
sales, sale_items, payments, cash_closings, quotations(+items), invoices(+items), suppliers, purchases(+items),
expenses, products (fuel products with unit = litre; shop items), stock_levels, inventory_transactions,
storedFiles (photos), messageLog (reminders), billing.

**New tables:**
| Table | Key fields |
|---|---|
| `fuel_tanks` | outlet, product, name, capacity_l, reorder_l, storage (tank/drums), drum_size_l, chart (jsonb: cm → L) |
| `fuel_nozzles` | outlet, dispenser label, product, tank, has_meter, current_totaliser, active |
| `fuel_readings` | closing (cash_closings.id), nozzle, opening, closing, litres, amount |
| `fuel_dips` | tank, measured_at, dip_cm or drums, measured_l, book_l, variance_l, user |
| `fuel_deliveries` | purchase (purchases.id), tank, invoiced_l, dip_before, dip_after, received_l, cost_per_l, note photo |
| `price_lists` / `price_list_prices` | name; product, price, effective_from (history = rows over time) |
| `customer_vehicles` | customer, kind (boat/vehicle/generator), reg_no, length_ft |
| `quotation_usage` (or columns) | quotation, approved_l per product, used_l |

**Columns added:** `sale_items.nozzle_id`, `sale_items.litres`, `sales.vehicle_id`, `sales.quotation_id`;
`cash_closings` gets `kind` (shift/day) and `attendants`; `customers.price_list_id`, `customers.needs_invoice`,
`customers.added_at_till_by`.

## 8. Roles

| Role | Can |
|---|---|
| Owner | Everything; approvals; settings; prices; reports |
| Manager | All operations, credit, quotations/invoices, reports; no billing |
| Attendant / cashier | Sell, + new customer (within limit), petty-cash expense (within limit), close own shift, record dip |
| Accountant | Read reports, invoices, statements, expenses; export |

## 9. Reports (formulas)

- Daily: Σ nozzle litres × price; payments by method; shifts over/short.
- Shift: readings → expected; − non-cash − expenses = cash expected; counted − expected.
- Tank: book = opening + received − sold; variance = dip − book.
- Receivables ageing by due date; statements with running balance.
- Profit: fuel sales − (litres × average delivered cost) = fuel margin; + shop margin; − expenses; − fuel loss at cost.
- GST: **to confirm with MIRA / an accountant how GST applies to fuel** before building this report.

## 10. Plans (idea)

| Plan | For | MVR / month |
|---|---|---|
| Small | 1 nozzle, 1 tank/drums, no shifts | 299–399 |
| Standard | up to 4 nozzles, 2 tanks, shifts, credit | 599–799 |
| Pro | more nozzles/tanks, quotations & invoices, several sheds | 999+ |

Free setup, 30-day trial, bank-transfer billing (existing).

## 11. Build phases

| Phase | Scope | Estimate |
|---|---|---|
| 0 | Validate with 4–6 sheds (demo pictures, questions) | 1 week |
| 1 | Product `fuel`, sign-up, setup wizard, nozzles/tanks, till, day/shift close, dips, deliveries, prices, credit customers, quick-add, expenses, core reports, 6 languages, tests | 3–4 weeks |
| 2 | Quotations & invoices for government (reuse Gravity), statements & reminders, owner phone view, profit report | 1–2 weeks |
| 3 | Pilot at 2–3 sheds, fixes | 4 weeks |
| Later | Pump controller integration, automatic tank gauges, boat-owner app, multi-shed dashboards | — |

## 12. Open questions

1. GST treatment of fuel sales (rate / zero-rated / exempt) and what the GST report must show. — **parked: discuss last**; the GST setting stays configurable (rate per item, can be 0%) so nothing blocks the build.
2. ~~Web address~~ — decided: `theyo.oceanx.app`.
3. ~~Printing~~ — decided: optional (off by default); support 80 mm thermal when a shed has one.
4. Do sheds need delivery (bowser/drums to boats) as a separate charge/flow?
5. ~~App icon~~ — decided: the two-word logo in white on **black** (files: `docs/marketing/fuel-demo/logo/icons/theyofihaara-icon-black-*.png`).
