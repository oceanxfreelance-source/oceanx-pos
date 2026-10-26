# Theyo Fihaara (ތެޔޮ ފިހާރަ) — fuel shed POS plan

Status: plan + demo pictures (docs/marketing/fuel-demo/fuel-v3-*.jpg). Not built.
Name: Theyo Fihaara (ތެޔޮ ފިހާރަ), by OceanX. Logo: docs/marketing/fuel-demo/logo/fuel-logo.png (product logo, not a shed logo).

## Who it's for
Private and council-run island fuel sheds, harbour fuel sellers (fishing boats, speedboats),
companies with their own fuel stock. Not FSM / Hawks at first (they have big systems).

## Build approach
A new business type "Fuel" inside OceanX POS (like takeaway), reusing:
sales/receipts, payments, shifts + cash closing over/short, credit customers, shop items,
GST reports, offline mode, staff roles, 6 languages, Super Admin, billing.

## New modules
1. Pumps & nozzles (product, price, opening totaliser)
2. Fuel sale screen (pick nozzle, litres or amount, cash/card/QR/transfer/account)
3. Shift close by meter readings (litres × price → expected; payments by type; over/short, tolerance, note)
4. Tanks: capacity, calibration chart (cm → litres), daily dip, book stock, variance + alert
5. Deliveries: supplier, invoiced vs received, cost, delivery note photo
6. Price changes with effective time (sales keep their price)
7. Credit accounts: boats (reg no, length), companies, councils; limits, terms (15 days), prepaid balances,
   statements, Viber/SMS reminders, optional litre allowance per period
8. Owner phone view: live sales, shifts, tanks, receivables, alerts
9. Reports: daily/monthly litres & revenue, shift history, variance, receivables ageing, GST

## Phases
- Week 1: visit 4–6 sheds with demo, 8 questions, photos of shift/credit books. Go if ≥3 say yes.
- Weeks 2–4: build v1 (modules 1–7 + reports), tests, 6 languages.
- Weeks 5–8: free pilot at 2–3 sheds; weekly fixes.
- Week 9+: launch; owner phone view; marketing.
- Later (v2): pump controller integration (Technotrade-type), automatic tank gauges, customer app for boat owners, multi-shed.

## Pricing idea
MVR 599–999/month per shed (by pumps/tanks), free setup, 30-day trial. Pay by bank transfer (existing billing).

## Risks
Small market; owners used to paper; credit customers resist; internet on islands (offline helps);
correct GST handling for fuel; need accurate tank charts.

## Till: customer + payment (agreed with owner)
- Step 1 customer: "Walk-in" (default, no name) or a credit customer picked from the list
  (credit customers are added beforehand in Credit accounts; names are only for them).
- Step 2 payment: Cash · Card · QR/transfer · Unpaid (pay later) · On account (credit customers only, within limit).
- Walk-in + Unpaid: no name; the sale keeps time served, pump, litres, amount, staff (+ optional short note).
- Unpaid list sorted by time; when money arrives staff match by time + amount (app suggests same-amount sales),
  Mark paid (cash/transfer/QR, optional screenshot). An unpaid walk-in sale can be moved to a credit customer later.
- Shift close counts each payment type separately (Unpaid walk-in and On account apart from cash).
- No OTP, ID card, signature or photo (too slow for island sheds).

## Expenses (agreed)
- From shift cash (petty cash): "Expense" at the till — amount, category, note, optional bill photo;
  deducted from cash expected at shift close; owner limit per expense (e.g. MVR 500, above needs owner).
- Owner/office expenses: salaries, electricity/water/internet, rent/licence, pump & tank maintenance,
  generator/transport, bank charges; paid by cash/transfer/card; bill photo; repeat monthly option.
- Fuel purchases are NOT expenses here — they come from Deliveries (fuel cost).
- Profit report: fuel sales − fuel cost = fuel margin; + shop margin; − expenses = net profit;
  expenses by category; running cost per litre; GST on bills shown separately. Reuse Gravity Flow expenses.

## Small sheds (agreed)
- Setup decides the screens: any number of dispensers/nozzles/tanks, including 1 dispenser · 1 nozzle · 1 tank.
- 1 nozzle: till has no pump choice; shift close has one meter reading; overview/reports simplified.
- No working meter: staff enter litres (or amount) per sale; shift check uses stock (start − end).
- Drums instead of a tank: stock as full drums + litres in the open drum; deliveries recorded in drums.
- Smaller plan for 1 nozzle / 1 tank (idea: MVR 299–399/month).

## One-person sheds, no shifts (agreed)
- Setting: "One person, no shifts" (day close) or "Shifts with staff" (shift close); can switch later.
- No shifts: just sell all day; every sale keeps time, litres, amount, payment, customer.
- Day close (optional, daily or weekly): meter reading → litres and money expected → minus credit/transfer/card/QR/unpaid/expenses → count cash → over/short.
- Hidden when off: shift numbers, attendant names, by-staff reports, shift tolerance/notes.
- Smallest version: 1 person · 1 nozzle · no shifts.

## Quotations and invoices (government / big customers) (agreed)
- Reuse Gravity quotations & invoices (PDF English/Dhivehi, logo, send by email/Viber, print).
- Quotation: customer (council, school, health centre, office, company), litres × price per product,
  delivery charge, validity, terms; status Draft → Sent → Approved (+ PO/approval number).
- Fills at the till linked to customer + quotation: date, vehicle/boat/generator, litres, staff,
  signed delivery note (photo/signature); quotation shows litres used vs approved; warn when near limit.
- Invoice: one click from quotation, or monthly from all fills; includes PO/quotation number,
  each fill, totals, GST as configured, bank account, terms; delivery notes attached.
- Payment later: Unpaid → Part paid → Paid, due date, overdue alert; shows in receivables ageing and statements.
- Customer type option: "Needs quotation & invoice".

## Customer types (final, agreed)
- Walk-in: pays on the spot (cash, card, QR, transfer). No name.
- Credit customer: boats, companies, councils/government (invoice customers). Sales go to credit (unpaid)
  until paid. Invoice customers' fills are credit; quotation/invoice is paperwork on top:
  quotation → approved → fills on credit → invoice from fills → unpaid → paid.
- One Credit list shows everyone who owes (credit accounts + invoice customers), with balances and ageing.
- DECIDED: no unnamed unpaid sales. If a walk-in will pay later, the salesperson quick-adds them at the till
  (name required; phone and vehicle/boat optional) and the sale goes on credit under that name.
  Owner sees new customers added today and by whom; optional limit for quick-added customers
  (e.g. MVR 500 until approved) and a warning if the name already owes money.
  (This replaces the earlier "Walk-in + Unpaid by time" idea.)

## Decided (26 Oct 2026)
- Address: theyofihaara.oceanx.app
- Printing is optional (off by default); digital receipts / PDF always available; 80 mm thermal supported when present.
