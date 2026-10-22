ALTER TABLE "budget_goals" DROP CONSTRAINT "budget_goals_target_ck";--> statement-breakpoint
ALTER TABLE "budget_goals" DROP CONSTRAINT "budget_goals_kind_ck";--> statement-breakpoint
DROP INDEX "budget_categories_name_uq";--> statement-breakpoint
ALTER TABLE "budget_goals" ALTER COLUMN "target" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_categories" ADD COLUMN "wallet" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD COLUMN "wallet" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_goals" ADD COLUMN "wallet" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "budget_usd_wallet" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_goals_one_savings_uq" ON "budget_goals" USING btree ("business_id","wallet") WHERE "budget_goals"."kind" = 'savings' AND "budget_goals"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_categories_name_uq" ON "budget_categories" USING btree ("business_id","wallet","kind",lower("name")) WHERE "budget_categories"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "budget_goals" ADD CONSTRAINT "budget_goals_target_ck" CHECK ("budget_goals"."kind" = 'savings' OR "budget_goals"."target" > 0);--> statement-breakpoint
ALTER TABLE "budget_goals" ADD CONSTRAINT "budget_goals_kind_ck" CHECK ("budget_goals"."kind" IN ('goal','emergency','savings'));