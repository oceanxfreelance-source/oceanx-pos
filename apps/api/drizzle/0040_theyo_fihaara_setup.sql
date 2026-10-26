CREATE TABLE "fuel_nozzles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"tank_id" uuid NOT NULL,
	"name" text NOT NULL,
	"opening_meter" numeric(14, 2) DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fuel_sheds" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"setup_done_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "fuel_tanks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"fuel" text NOT NULL,
	"storage" text DEFAULT 'tank' NOT NULL,
	"capacity_l" numeric(12, 2) NOT NULL,
	"reorder_l" numeric(12, 2) DEFAULT 0 NOT NULL,
	"drum_size_l" integer DEFAULT 200 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fuel_tanks_fuel_ck" CHECK ("fuel_tanks"."fuel" IN ('petrol','diesel')),
	CONSTRAINT "fuel_tanks_storage_ck" CHECK ("fuel_tanks"."storage" IN ('tank','drums'))
);
--> statement-breakpoint
ALTER TABLE "fuel_nozzles" ADD CONSTRAINT "fuel_nozzles_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_nozzles" ADD CONSTRAINT "fuel_nozzles_tank_id_fuel_tanks_id_fk" FOREIGN KEY ("tank_id") REFERENCES "public"."fuel_tanks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_sheds" ADD CONSTRAINT "fuel_sheds_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_tanks" ADD CONSTRAINT "fuel_tanks_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fuel_nozzles_business_idx" ON "fuel_nozzles" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "fuel_tanks_business_idx" ON "fuel_tanks" USING btree ("business_id");