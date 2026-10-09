ALTER TABLE "customers" ADD COLUMN "kind" text DEFAULT 'person' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "customer_ref" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "customer_ref" text DEFAULT '' NOT NULL;