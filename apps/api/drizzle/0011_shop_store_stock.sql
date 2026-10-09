ALTER TABLE "inventory_transactions" ADD COLUMN "location" text DEFAULT 'shop' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "min_store_stock" numeric(14, 3) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD COLUMN "store_quantity" numeric(14, 3) DEFAULT 0 NOT NULL;