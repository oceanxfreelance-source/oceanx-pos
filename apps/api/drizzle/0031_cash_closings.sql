CREATE TABLE "cash_closings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"sales_total" bigint DEFAULT 0 NOT NULL,
	"by_method" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"opening_float" bigint DEFAULT 0 NOT NULL,
	"cash_in" bigint DEFAULT 0 NOT NULL,
	"change_given" bigint DEFAULT 0 NOT NULL,
	"cash_refunds" bigint DEFAULT 0 NOT NULL,
	"expected_cash" bigint DEFAULT 0 NOT NULL,
	"counted_cash" bigint DEFAULT 0 NOT NULL,
	"difference" bigint DEFAULT 0 NOT NULL,
	"kept_float" bigint DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"closed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_closings_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_closings_outlet_number_uq" ON "cash_closings" USING btree ("business_id","outlet_id","number");--> statement-breakpoint
CREATE INDEX "cash_closings_outlet_end_idx" ON "cash_closings" USING btree ("business_id","outlet_id","period_end");