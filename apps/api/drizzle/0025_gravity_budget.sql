CREATE TABLE "budget_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" bigint NOT NULL,
	"due_day" integer NOT NULL,
	"category_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "budget_bills_business_id_uq" UNIQUE("business_id","id"),
	CONSTRAINT "budget_bills_amount_ck" CHECK ("budget_bills"."amount" > 0),
	CONSTRAINT "budget_bills_due_day_ck" CHECK ("budget_bills"."due_day" BETWEEN 1 AND 31)
);
--> statement-breakpoint
CREATE TABLE "budget_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '' NOT NULL,
	"monthly_limit" bigint,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "budget_categories_business_id_uq" UNIQUE("business_id","id"),
	CONSTRAINT "budget_categories_kind_ck" CHECK ("budget_categories"."kind" IN ('income','expense')),
	CONSTRAINT "budget_categories_limit_ck" CHECK ("budget_categories"."monthly_limit" IS NULL OR "budget_categories"."monthly_limit" > 0)
);
--> statement-breakpoint
CREATE TABLE "budget_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"category_id" uuid,
	"amount" bigint NOT NULL,
	"occurred_on" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"paid_with" text DEFAULT 'cash' NOT NULL,
	"bill_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "budget_entries_kind_ck" CHECK ("budget_entries"."kind" IN ('income','expense')),
	CONSTRAINT "budget_entries_amount_ck" CHECK ("budget_entries"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "budget_goal_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"occurred_on" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_goal_moves_amount_ck" CHECK ("budget_goal_moves"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "budget_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '' NOT NULL,
	"target" bigint NOT NULL,
	"target_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "budget_goals_business_id_uq" UNIQUE("business_id","id"),
	CONSTRAINT "budget_goals_target_ck" CHECK ("budget_goals"."target" > 0)
);
--> statement-breakpoint
ALTER TABLE "budget_bills" ADD CONSTRAINT "budget_bills_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_bills" ADD CONSTRAINT "budget_bills_category_fk" FOREIGN KEY ("business_id","category_id") REFERENCES "public"."budget_categories"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_category_fk" FOREIGN KEY ("business_id","category_id") REFERENCES "public"."budget_categories"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_bill_fk" FOREIGN KEY ("business_id","bill_id") REFERENCES "public"."budget_bills"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_goal_moves" ADD CONSTRAINT "budget_goal_moves_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_goal_moves" ADD CONSTRAINT "budget_goal_moves_goal_fk" FOREIGN KEY ("business_id","goal_id") REFERENCES "public"."budget_goals"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_goals" ADD CONSTRAINT "budget_goals_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_categories_name_uq" ON "budget_categories" USING btree ("business_id","kind",lower("name")) WHERE "budget_categories"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "budget_entries_business_day_idx" ON "budget_entries" USING btree ("business_id","occurred_on");--> statement-breakpoint
CREATE INDEX "budget_goal_moves_goal_idx" ON "budget_goal_moves" USING btree ("business_id","goal_id");-- Gravity Budget is an OceanX project in Super Admin's main office, like Gravity and Gravity Flow.
INSERT INTO "hub_ventures" ("name", "kind", "description", "color", "sort_order") VALUES ('Gravity Budget', 'budget', 'Personal budgets, bills and savings goals.', 'amber', 3) ON CONFLICT DO NOTHING;
