CREATE TABLE "budget_loan_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"occurred_on" text NOT NULL,
	"due_on" text,
	"note" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_loan_entries_amount_ck" CHECK ("budget_loan_entries"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "budget_loan_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "beta_features" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_loan_entries" ADD CONSTRAINT "budget_loan_entries_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_loan_entries" ADD CONSTRAINT "budget_loan_entries_person_id_budget_loan_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."budget_loan_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_loan_people" ADD CONSTRAINT "budget_loan_people_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_loan_entries_person_idx" ON "budget_loan_entries" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "budget_loan_entries_business_idx" ON "budget_loan_entries" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "budget_loan_people_business_idx" ON "budget_loan_people" USING btree ("business_id");