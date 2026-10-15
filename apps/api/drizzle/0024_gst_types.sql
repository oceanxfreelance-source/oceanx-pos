ALTER TABLE "expenses" ADD COLUMN "supplier_tin" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "gst_type" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "gst_type" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "tax_number" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Products and past sale lines with an explicit 0% rate were sold without GST: treat them as zero-rated.
UPDATE "products" SET "gst_type" = 'zero_rated' WHERE "tax_rate" = 0;--> statement-breakpoint
UPDATE "sale_items" SET "gst_type" = 'zero_rated' WHERE "tax_rate" = 0 AND "tax" = 0;
