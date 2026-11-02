CREATE TABLE "budget_salary_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount_due" bigint NOT NULL,
	"monthly_amount" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "budget_salary_loans_business_id_uq" UNIQUE("business_id","id"),
	CONSTRAINT "budget_salary_loans_amount_ck" CHECK ("budget_salary_loans"."amount_due" > 0 AND "budget_salary_loans"."monthly_amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "budget_entries" ADD COLUMN "salary_loan_id" uuid;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD COLUMN "from_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "budget_salary_loans" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_salary_loans" ADD CONSTRAINT "budget_salary_loans_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_salary_loan_fk" FOREIGN KEY ("business_id","salary_loan_id") REFERENCES "public"."budget_salary_loans"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_entries_from_entry_idx" ON "budget_entries" USING btree ("from_entry_id");