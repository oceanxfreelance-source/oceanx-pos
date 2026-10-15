CREATE TABLE "sale_refund_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"refund_id" uuid NOT NULL,
	"sale_item_id" uuid NOT NULL,
	"name_snapshot" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"tax_rate" numeric(6, 3) DEFAULT 0 NOT NULL,
	"net" bigint NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"number" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"method" text NOT NULL,
	"total" bigint NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL,
	"restocked" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_refunds_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "tax" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "tax" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "refunded_total" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_refund_items" ADD CONSTRAINT "sale_refund_items_refund_fk" FOREIGN KEY ("business_id","refund_id") REFERENCES "public"."sale_refunds"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_refunds" ADD CONSTRAINT "sale_refunds_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "public"."sales"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_refund_items_refund_idx" ON "sale_refund_items" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "sale_refund_items_item_idx" ON "sale_refund_items" USING btree ("sale_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_refunds_business_number_uq" ON "sale_refunds" USING btree ("business_id","number");--> statement-breakpoint
CREATE INDEX "sale_refunds_sale_idx" ON "sale_refunds" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_refunds_business_created_idx" ON "sale_refunds" USING btree ("business_id","created_at");