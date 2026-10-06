CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"kitchen_station" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"tax_number" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"credit_limit" bigint,
	"credit_days" integer,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "customers_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "dining_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"capacity" integer DEFAULT 4 NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tables_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"category" text NOT NULL,
	"amount" bigint NOT NULL,
	"expense_date" text NOT NULL,
	"payment_method" text NOT NULL,
	"payee" text DEFAULT '' NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"attachment_path" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "expenses_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"balance_after" numeric(14, 3) NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"note" text DEFAULT '' NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"product_id" uuid,
	"item_name_snapshot" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit" text DEFAULT 'pcs' NOT NULL,
	"unit_price" bigint NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"tax_rate" numeric(6, 3),
	"tax" bigint DEFAULT 0 NOT NULL,
	"total" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"outlet_id" uuid,
	"number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"invoice_date" text NOT NULL,
	"due_date" text NOT NULL,
	"salesperson_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"source_quotation_id" uuid,
	"language" text,
	"notes" text DEFAULT '' NOT NULL,
	"terms" text DEFAULT '' NOT NULL,
	"currency" text NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"order_discount" bigint DEFAULT 0 NOT NULL,
	"service_charge" bigint DEFAULT 0 NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"balance_due" bigint DEFAULT 0 NOT NULL,
	"tax_config" jsonb NOT NULL,
	"void_reason" text,
	"issued_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "karaoke_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"customer_id" uuid,
	"customer_name" text NOT NULL,
	"customer_phone" text DEFAULT '' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"hourly_rate" bigint NOT NULL,
	"total" bigint NOT NULL,
	"deposit" bigint DEFAULT 0 NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "karaoke_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"capacity" integer NOT NULL,
	"hourly_rate" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "karaoke_rooms_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "kitchen_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"ticket_number" integer NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"order_type" text NOT NULL,
	"table_name" text,
	"station" text DEFAULT '' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"items" jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "loyalty_transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" text NOT NULL,
	"sale_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"outlet_id" uuid,
	"customer_id" uuid,
	"sale_id" uuid,
	"invoice_id" uuid,
	"booking_id" uuid,
	"kind" text NOT NULL,
	"method" text NOT NULL,
	"amount" bigint NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"received_by" uuid,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"sku" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT 'pcs' NOT NULL,
	"type" text DEFAULT 'item' NOT NULL,
	"cost_price" bigint DEFAULT 0 NOT NULL,
	"selling_price" bigint DEFAULT 0 NOT NULL,
	"tax_rate" numeric(6, 3),
	"track_stock" boolean DEFAULT false NOT NULL,
	"min_stock" numeric(14, 3) DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"show_in_pos" boolean DEFAULT true NOT NULL,
	"show_in_menu" boolean DEFAULT true NOT NULL,
	"send_to_kitchen" boolean DEFAULT true NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "products_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"purchase_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name_snapshot" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_cost" bigint NOT NULL,
	"total" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"number" text NOT NULL,
	"purchase_date" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"received_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"quotation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"product_id" uuid,
	"item_name_snapshot" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit" text DEFAULT 'pcs' NOT NULL,
	"unit_price" bigint NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"tax_rate" numeric(6, 3),
	"tax" bigint DEFAULT 0 NOT NULL,
	"total" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"outlet_id" uuid,
	"number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"quotation_date" text NOT NULL,
	"valid_until" text NOT NULL,
	"salesperson_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"language" text,
	"notes" text DEFAULT '' NOT NULL,
	"terms" text DEFAULT '' NOT NULL,
	"currency" text NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"order_discount" bigint DEFAULT 0 NOT NULL,
	"service_charge" bigint DEFAULT 0 NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"tax_config" jsonb NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "recipe_items" (
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	CONSTRAINT "recipe_items_product_id_ingredient_id_pk" PRIMARY KEY("product_id","ingredient_id")
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"table_id" uuid,
	"customer_name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"party_size" integer NOT NULL,
	"reserved_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 90 NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid,
	"category_id" uuid,
	"name_snapshot" text NOT NULL,
	"sku_snapshot" text DEFAULT '' NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" bigint NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"tax_rate" numeric(6, 3) DEFAULT 0 NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL,
	"total" bigint NOT NULL,
	"cost_price" bigint DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"send_to_kitchen" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"number" text,
	"status" text DEFAULT 'open' NOT NULL,
	"source" text DEFAULT 'pos' NOT NULL,
	"order_type" text DEFAULT 'dine_in' NOT NULL,
	"table_id" uuid,
	"customer_id" uuid,
	"cashier_id" uuid,
	"currency" text NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"service_charge" bigint DEFAULT 0 NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL,
	"delivery_fee" bigint DEFAULT 0 NOT NULL,
	"points_discount" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"change_amount" bigint DEFAULT 0 NOT NULL,
	"balance_due" bigint DEFAULT 0 NOT NULL,
	"points_redeemed" integer DEFAULT 0 NOT NULL,
	"points_earned" integer DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"delivery" jsonb,
	"online_customer" jsonb,
	"void_reason" text,
	"voided_by" uuid,
	"voided_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "stock_levels" (
	"business_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(14, 3) DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_levels_outlet_id_product_id_pk" PRIMARY KEY("outlet_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"from_outlet_id" uuid NOT NULL,
	"to_outlet_id" uuid NOT NULL,
	"items" jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dining_tables" ADD CONSTRAINT "tables_outlet_fk" FOREIGN KEY ("business_id","outlet_id") REFERENCES "public"."outlets"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_outlet_fk" FOREIGN KEY ("business_id","outlet_id") REFERENCES "public"."outlets"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_tx_outlet_fk" FOREIGN KEY ("business_id","outlet_id") REFERENCES "public"."outlets"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_tx_product_fk" FOREIGN KEY ("business_id","product_id") REFERENCES "public"."products"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_i_fk" FOREIGN KEY ("business_id","invoice_id") REFERENCES "public"."invoices"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_fk" FOREIGN KEY ("business_id","customer_id") REFERENCES "public"."customers"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karaoke_bookings" ADD CONSTRAINT "karaoke_bookings_room_fk" FOREIGN KEY ("business_id","room_id") REFERENCES "public"."karaoke_rooms"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karaoke_bookings" ADD CONSTRAINT "karaoke_bookings_customer_fk" FOREIGN KEY ("business_id","customer_id") REFERENCES "public"."customers"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karaoke_rooms" ADD CONSTRAINT "karaoke_rooms_outlet_fk" FOREIGN KEY ("business_id","outlet_id") REFERENCES "public"."outlets"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_orders" ADD CONSTRAINT "kitchen_orders_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "public"."sales"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_tx_customer_fk" FOREIGN KEY ("business_id","customer_id") REFERENCES "public"."customers"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_fk" FOREIGN KEY ("business_id","user_id") REFERENCES "public"."users"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "public"."sales"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_fk" FOREIGN KEY ("business_id","invoice_id") REFERENCES "public"."invoices"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_fk" FOREIGN KEY ("business_id","customer_id") REFERENCES "public"."customers"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_fk" FOREIGN KEY ("business_id","category_id") REFERENCES "public"."categories"("business_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_p_fk" FOREIGN KEY ("business_id","purchase_id") REFERENCES "public"."purchases"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_fk" FOREIGN KEY ("business_id","product_id") REFERENCES "public"."products"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_fk" FOREIGN KEY ("business_id","supplier_id") REFERENCES "public"."suppliers"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_outlet_fk" FOREIGN KEY ("business_id","outlet_id") REFERENCES "public"."outlets"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_q_fk" FOREIGN KEY ("business_id","quotation_id") REFERENCES "public"."quotations"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_fk" FOREIGN KEY ("business_id","customer_id") REFERENCES "public"."customers"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_product_fk" FOREIGN KEY ("business_id","product_id") REFERENCES "public"."products"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_ingredient_fk" FOREIGN KEY ("business_id","ingredient_id") REFERENCES "public"."products"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_table_fk" FOREIGN KEY ("business_id","table_id") REFERENCES "public"."dining_tables"("business_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "public"."sales"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_outlet_fk" FOREIGN KEY ("business_id","outlet_id") REFERENCES "public"."outlets"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_fk" FOREIGN KEY ("business_id","customer_id") REFERENCES "public"."customers"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_table_fk" FOREIGN KEY ("business_id","table_id") REFERENCES "public"."dining_tables"("business_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_outlet_fk" FOREIGN KEY ("business_id","outlet_id") REFERENCES "public"."outlets"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_product_fk" FOREIGN KEY ("business_id","product_id") REFERENCES "public"."products"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_fk" FOREIGN KEY ("business_id","from_outlet_id") REFERENCES "public"."outlets"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_fk" FOREIGN KEY ("business_id","to_outlet_id") REFERENCES "public"."outlets"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_business_name_uq" ON "categories" USING btree ("business_id",lower("name"));--> statement-breakpoint
CREATE INDEX "customers_business_name_idx" ON "customers" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "customers_business_phone_idx" ON "customers" USING btree ("business_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "tables_outlet_name_uq" ON "dining_tables" USING btree ("outlet_id",lower("name"));--> statement-breakpoint
CREATE INDEX "expenses_business_date_idx" ON "expenses" USING btree ("business_id","expense_date");--> statement-breakpoint
CREATE INDEX "inventory_tx_business_product_idx" ON "inventory_transactions" USING btree ("business_id","product_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_tx_business_created_idx" ON "inventory_transactions" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "invoice_items_i_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_business_number_uq" ON "invoices" USING btree ("business_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_source_quotation_uq" ON "invoices" USING btree ("source_quotation_id") WHERE "invoices"."source_quotation_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "invoices_business_status_idx" ON "invoices" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "invoices_business_customer_idx" ON "invoices" USING btree ("business_id","customer_id");--> statement-breakpoint
CREATE INDEX "karaoke_bookings_room_time_idx" ON "karaoke_bookings" USING btree ("room_id","start_at");--> statement-breakpoint
CREATE INDEX "kitchen_orders_outlet_status_idx" ON "kitchen_orders" USING btree ("business_id","outlet_id","status","created_at");--> statement-breakpoint
CREATE INDEX "loyalty_tx_customer_idx" ON "loyalty_transactions" USING btree ("business_id","customer_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "payments_business_paid_idx" ON "payments" USING btree ("business_id","paid_at");--> statement-breakpoint
CREATE INDEX "payments_sale_idx" ON "payments" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_business_customer_idx" ON "payments" USING btree ("business_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_business_sku_uq" ON "products" USING btree ("business_id",lower("sku")) WHERE "products"."sku" <> '' AND "products"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "products_business_category_idx" ON "products" USING btree ("business_id","category_id");--> statement-breakpoint
CREATE INDEX "products_business_name_idx" ON "products" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "purchase_items_p_idx" ON "purchase_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_business_number_uq" ON "purchases" USING btree ("business_id","number");--> statement-breakpoint
CREATE INDEX "purchases_business_supplier_idx" ON "purchases" USING btree ("business_id","supplier_id");--> statement-breakpoint
CREATE INDEX "quotation_items_q_idx" ON "quotation_items" USING btree ("quotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotations_business_number_uq" ON "quotations" USING btree ("business_id","number");--> statement-breakpoint
CREATE INDEX "quotations_business_status_idx" ON "quotations" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "quotations_business_customer_idx" ON "quotations" USING btree ("business_id","customer_id");--> statement-breakpoint
CREATE INDEX "reservations_outlet_time_idx" ON "reservations" USING btree ("business_id","outlet_id","reserved_at");--> statement-breakpoint
CREATE INDEX "sale_items_sale_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_business_product_idx" ON "sale_items" USING btree ("business_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_business_number_uq" ON "sales" USING btree ("business_id","number") WHERE "sales"."number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sales_business_created_idx" ON "sales" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "sales_business_status_idx" ON "sales" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "sales_business_customer_idx" ON "sales" USING btree ("business_id","customer_id");--> statement-breakpoint
CREATE INDEX "stock_levels_business_idx" ON "stock_levels" USING btree ("business_id","product_id");--> statement-breakpoint
CREATE INDEX "stock_transfers_business_idx" ON "stock_transfers" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "suppliers_business_name_idx" ON "suppliers" USING btree ("business_id","name");