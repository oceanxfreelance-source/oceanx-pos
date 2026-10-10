DROP INDEX "hub_ventures_pos_uq";--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "product" text DEFAULT 'pos' NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "product" text DEFAULT 'pos' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "hub_ventures_builtin_uq" ON "hub_ventures" USING btree ("kind") WHERE "hub_ventures"."kind" <> 'custom';--> statement-breakpoint
CREATE INDEX "businesses_product_idx" ON "businesses" USING btree ("product");--> statement-breakpoint
INSERT INTO "hub_ventures" ("name", "kind", "description", "color", "sort_order") VALUES ('Gravity', 'gravity', 'Quotation & invoice generator in English and Dhivehi.', 'violet', 1) ON CONFLICT DO NOTHING;