CREATE TABLE "billing_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"months" integer NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"method" text NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"slip_path" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"receipt_number" text,
	"submitted_by_user" uuid,
	"recorded_by_admin" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text DEFAULT '' NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_submitted_by_user_users_id_fk" FOREIGN KEY ("submitted_by_user") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_recorded_by_admin_super_admins_id_fk" FOREIGN KEY ("recorded_by_admin") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_reviewed_by_super_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_payments_business_idx" ON "billing_payments" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "billing_payments_status_idx" ON "billing_payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_payments_receipt_uq" ON "billing_payments" USING btree ("receipt_number");