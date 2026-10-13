CREATE TABLE "signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"product" text NOT NULL,
	"business_name" text NOT NULL,
	"owner_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"currency" text,
	"language" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trial_ended_notice_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"delete_reason" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "signups_business_uq" ON "signups" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "signups_created_idx" ON "signups" USING btree ("created_at");--> statement-breakpoint
-- Existing Gravity accounts get their sign-up record too (owner details from the owner user).
INSERT INTO "signups" ("business_id", "product", "business_name", "owner_name", "email", "phone", "currency", "language", "created_at")
SELECT b."id", b."product", b."name", coalesce(u."name", ''), coalesce(u."email", b."email", ''), nullif(coalesce(nullif(u."phone", ''), b."phone"), ''), b."currency", u."language", b."created_at"
FROM "businesses" b
LEFT JOIN LATERAL (SELECT * FROM "users" WHERE "users"."business_id" = b."id" AND "users"."is_owner" ORDER BY "users"."created_at" LIMIT 1) u ON true
WHERE b."deleted_at" IS NULL AND b."product" = 'gravity'
ON CONFLICT DO NOTHING;
