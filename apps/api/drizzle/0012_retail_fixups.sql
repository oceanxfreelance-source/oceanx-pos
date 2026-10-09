-- Shops have no ingredients or kitchen: everything they stock is a product for sale.
UPDATE "products" SET "type" = 'item', "send_to_kitchen" = false
WHERE "type" = 'ingredient' AND "business_id" IN (SELECT "id" FROM "businesses" WHERE "business_type"::text IN ('retail_shop', 'supermarket'));
--> statement-breakpoint
-- Shops keep only Owner and Cashier / Salesperson; remove the restaurant roles nobody holds.
DELETE FROM "roles" r
WHERE r."system_key" IN ('manager', 'salesperson', 'kitchen_staff', 'waiter')
  AND r."business_id" IN (SELECT "id" FROM "businesses" WHERE "business_type"::text IN ('retail_shop', 'supermarket'))
  AND NOT EXISTS (SELECT 1 FROM "user_roles" ur WHERE ur."role_id" = r."id");
--> statement-breakpoint
UPDATE "roles" SET "name" = 'Owner'
WHERE "system_key" = 'business_admin' AND "name" = 'Business Admin'
  AND "business_id" IN (SELECT "id" FROM "businesses" WHERE "business_type"::text IN ('retail_shop', 'supermarket'));
--> statement-breakpoint
UPDATE "roles" SET "name" = 'Cashier / Salesperson'
WHERE "system_key" = 'cashier' AND "name" = 'Cashier'
  AND "business_id" IN (SELECT "id" FROM "businesses" WHERE "business_type"::text IN ('retail_shop', 'supermarket'));
--> statement-breakpoint
-- The shop cashier also checks stock, sees products and makes quotations / invoices.
INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT r."id", p."key" FROM "roles" r JOIN "permissions" p ON p."key" IN ('products.view', 'inventory.view', 'quotations.view', 'quotations.create', 'quotations.edit', 'quotations.print', 'quotations.send', 'invoices.view', 'invoices.create', 'invoices.print')
WHERE r."system_key" = 'cashier' AND r."business_id" IN (SELECT "id" FROM "businesses" WHERE "business_type"::text IN ('retail_shop', 'supermarket'))
ON CONFLICT DO NOTHING;
