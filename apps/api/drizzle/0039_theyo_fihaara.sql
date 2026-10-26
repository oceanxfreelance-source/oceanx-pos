-- Theyo Fihaara (fuel sheds): its built-in project in Super Admin. Its plan comes from reference data.
INSERT INTO "hub_ventures" ("name", "kind", "description", "color", "sort_order") VALUES ('Theyo Fihaara', 'fuel', 'Fuel shed system: pumps, tanks, shifts, credit customers, quotations and invoices.', 'slate', 4) ON CONFLICT DO NOTHING;
