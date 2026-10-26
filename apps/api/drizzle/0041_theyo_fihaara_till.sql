CREATE TABLE "fuel_credit_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_by_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"credit_limit" numeric(12, 2) DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fuel_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"nozzle_id" uuid NOT NULL,
	"tank_id" uuid NOT NULL,
	"fuel" text NOT NULL,
	"litres" numeric(12, 2) NOT NULL,
	"price_per_l" numeric(10, 2) NOT NULL,
	"fuel_amount" numeric(12, 2) NOT NULL,
	"delivery_charge" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"payment" text NOT NULL,
	"customer_id" uuid,
	"vehicle" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_by_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	CONSTRAINT "fuel_sales_payment_ck" CHECK ("fuel_sales"."payment" IN ('cash','card','transfer','credit')),
	CONSTRAINT "fuel_sales_credit_ck" CHECK ("fuel_sales"."payment" <> 'credit' OR "fuel_sales"."customer_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "fuel_stock_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"tank_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"litres" numeric(12, 2) NOT NULL,
	"book_l" numeric(12, 2),
	"cost" numeric(12, 2),
	"supplier" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_by_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fuel_stock_moves_kind_ck" CHECK ("fuel_stock_moves"."kind" IN ('delivery','dip'))
);
--> statement-breakpoint
ALTER TABLE "fuel_credit_payments" ADD CONSTRAINT "fuel_credit_payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_credit_payments" ADD CONSTRAINT "fuel_credit_payments_customer_id_fuel_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."fuel_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_customers" ADD CONSTRAINT "fuel_customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_sales" ADD CONSTRAINT "fuel_sales_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_sales" ADD CONSTRAINT "fuel_sales_nozzle_id_fuel_nozzles_id_fk" FOREIGN KEY ("nozzle_id") REFERENCES "public"."fuel_nozzles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_sales" ADD CONSTRAINT "fuel_sales_tank_id_fuel_tanks_id_fk" FOREIGN KEY ("tank_id") REFERENCES "public"."fuel_tanks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_sales" ADD CONSTRAINT "fuel_sales_customer_id_fuel_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."fuel_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_stock_moves" ADD CONSTRAINT "fuel_stock_moves_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_stock_moves" ADD CONSTRAINT "fuel_stock_moves_tank_id_fuel_tanks_id_fk" FOREIGN KEY ("tank_id") REFERENCES "public"."fuel_tanks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fuel_credit_payments_customer_idx" ON "fuel_credit_payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "fuel_customers_business_idx" ON "fuel_customers" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "fuel_sales_business_created_idx" ON "fuel_sales" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "fuel_sales_customer_idx" ON "fuel_sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "fuel_stock_moves_tank_idx" ON "fuel_stock_moves" USING btree ("tank_id","created_at");