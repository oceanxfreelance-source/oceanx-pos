CREATE TABLE "finance_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "finance_categories_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "finance_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"category_id" uuid,
	"amount" bigint NOT NULL,
	"occurred_on" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "finance_transactions_kind_ck" CHECK ("finance_transactions"."kind" IN ('income','expense')),
	CONSTRAINT "finance_transactions_amount_ck" CHECK ("finance_transactions"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_category_fk" FOREIGN KEY ("business_id","category_id") REFERENCES "public"."finance_categories"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_categories_name_uq" ON "finance_categories" USING btree ("business_id","kind",lower("name")) WHERE "finance_categories"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "finance_transactions_business_day_idx" ON "finance_transactions" USING btree ("business_id","occurred_on");--> statement-breakpoint
ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_kind_ck" CHECK ("kind" IN ('income','expense'));--> statement-breakpoint
-- Gravity Flow is an OceanX project in Super Admin's main office, like OceanX POS and Gravity.
INSERT INTO "hub_ventures" ("name", "kind", "description", "color", "sort_order") VALUES ('Gravity Flow', 'flow', 'Income, expenses and profit for small businesses.', 'green', 2) ON CONFLICT DO NOTHING;
