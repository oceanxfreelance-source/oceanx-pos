ALTER TABLE "plans" ADD COLUMN "trial_minutes" integer;--> statement-breakpoint
-- Gravity has one plan for everyone: "Gravity", a monthly price in MVR and a free trial (any length) set by Super Admin.
-- Gravity Pro becomes that plan (its USD price converted at 15.42); Gravity Trial's length becomes its trial.
UPDATE "plans" SET "code" = 'gravity', "name" = 'Gravity', "currency" = 'MVR',
  "price_monthly" = CASE WHEN "currency" = 'USD' THEN round("price_monthly" * 15.42) ELSE "price_monthly" END,
  "trial_minutes" = COALESCE((SELECT t."trial_days" * 1440 FROM "plans" t WHERE t."code" = 'gravity_trial'), 20160),
  "trial_days" = 0, "is_active" = true, "is_public" = true
WHERE "code" = 'gravity_pro' AND NOT EXISTS (SELECT 1 FROM "plans" g WHERE g."code" = 'gravity');--> statement-breakpoint
UPDATE "subscriptions" SET "plan_id" = (SELECT "id" FROM "plans" WHERE "code" = 'gravity')
WHERE "plan_id" IN (SELECT "id" FROM "plans" WHERE "code" = 'gravity_trial') AND EXISTS (SELECT 1 FROM "plans" WHERE "code" = 'gravity');--> statement-breakpoint
UPDATE "billing_payments" SET "plan_id" = (SELECT "id" FROM "plans" WHERE "code" = 'gravity')
WHERE "plan_id" IN (SELECT "id" FROM "plans" WHERE "code" = 'gravity_trial') AND EXISTS (SELECT 1 FROM "plans" WHERE "code" = 'gravity');--> statement-breakpoint
DELETE FROM "plans" WHERE "code" = 'gravity_trial' AND EXISTS (SELECT 1 FROM "plans" WHERE "code" = 'gravity');--> statement-breakpoint
UPDATE "platform_settings" SET "value" = '"gravity"'::jsonb WHERE "key" = 'gravityPlanCode' AND "value" = '"gravity_trial"'::jsonb;
