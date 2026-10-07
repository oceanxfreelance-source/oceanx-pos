CREATE TABLE "message_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"sale_id" uuid,
	"customer_id" uuid,
	"channel" text NOT NULL,
	"recipient" text NOT NULL,
	"body" text NOT NULL,
	"status" text NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "superadmin_viber_credit_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "manager_viber_credit_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "viber_credit_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "viber_country_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "viber_phone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "message_log" ADD CONSTRAINT "message_log_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_log_business_idx" ON "message_log" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_log_sale_channel_uq" ON "message_log" USING btree ("sale_id","channel");