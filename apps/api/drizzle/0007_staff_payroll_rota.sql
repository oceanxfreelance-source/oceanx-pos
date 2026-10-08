CREATE TABLE "addon_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"requested_by" uuid,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "addon_requests_uq" UNIQUE("business_id","addon_id")
);
--> statement-breakpoint
CREATE TABLE "payroll_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"staff_id" uuid,
	"name" text NOT NULL,
	"position" text DEFAULT '' NOT NULL,
	"basic" bigint DEFAULT 0 NOT NULL,
	"allowances" bigint DEFAULT 0 NOT NULL,
	"overtime" bigint DEFAULT 0 NOT NULL,
	"deductions" bigint DEFAULT 0 NOT NULL,
	"advance" bigint DEFAULT 0 NOT NULL,
	"net" bigint DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"period" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"total_net" bigint DEFAULT 0 NOT NULL,
	"expense_id" uuid,
	"created_by" uuid,
	"finalized_at" timestamp with time zone,
	"finalized_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_runs_business_id_uq" UNIQUE("business_id","id"),
	CONSTRAINT "payroll_runs_business_period_uq" UNIQUE("business_id","period")
);
--> statement-breakpoint
CREATE TABLE "rota_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"date" text NOT NULL,
	"kind" text NOT NULL,
	"shift_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rota_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"color" text DEFAULT 'sky' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rota_shifts_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"basic_salary" bigint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "staff_members_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
ALTER TABLE "addon_requests" ADD CONSTRAINT "addon_requests_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_requests" ADD CONSTRAINT "addon_requests_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_run_fk" FOREIGN KEY ("business_id","run_id") REFERENCES "public"."payroll_runs"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_staff_fk" FOREIGN KEY ("business_id","staff_id") REFERENCES "public"."staff_members"("business_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota_entries" ADD CONSTRAINT "rota_entries_staff_fk" FOREIGN KEY ("business_id","staff_id") REFERENCES "public"."staff_members"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota_entries" ADD CONSTRAINT "rota_entries_shift_fk" FOREIGN KEY ("business_id","shift_id") REFERENCES "public"."rota_shifts"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota_shifts" ADD CONSTRAINT "rota_shifts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payroll_lines_run_idx" ON "payroll_lines" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rota_entries_staff_date_uq" ON "rota_entries" USING btree ("business_id","staff_id","date");--> statement-breakpoint
CREATE INDEX "rota_entries_business_date_idx" ON "rota_entries" USING btree ("business_id","date");--> statement-breakpoint
CREATE INDEX "staff_members_business_idx" ON "staff_members" USING btree ("business_id");