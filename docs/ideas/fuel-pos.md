# Fuel shed POS (name not chosen yet) — plan

Status: plan + demo pictures (docs/marketing/fuel-demo/fuel-v3-*.jpg). Not built.
Name options: Hakatha (ހަކަތަ), Theyo (ތެޔޮ), Furihama, OceanX Fuel, Octane, Litre.

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
