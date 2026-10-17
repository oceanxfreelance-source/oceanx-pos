-- Gravity Flow: MVR 65 a month, 5-hour free trial (the plan new Flow sign-ups get; existing trials keep their end).
UPDATE "plans" SET "price_monthly" = 65, "trial_minutes" = 300, "trial_days" = 0
WHERE "product" = 'flow' AND "code" = COALESCE((SELECT "value" #>> '{}' FROM "platform_settings" WHERE "key" = 'flowPlanCode'), 'flow');
