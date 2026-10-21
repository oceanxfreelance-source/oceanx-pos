CREATE TABLE "trial_uses" (
	"email" text NOT NULL,
	"product" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trial_uses_email_product_pk" PRIMARY KEY("email","product")
);
--> statement-breakpoint
-- Emails that already had a trial: every current account owner, and every sign-up kept after deletion.
INSERT INTO "trial_uses" ("email", "product", "created_at")
SELECT lower(u."email"), b."product", min(b."created_at")
FROM "users" u JOIN "businesses" b ON b."id" = u."business_id"
WHERE u."is_owner" AND u."deleted_at" IS NULL AND b."product" <> 'pos'
GROUP BY lower(u."email"), b."product"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "trial_uses" ("email", "product", "created_at")
SELECT lower("email"), "product", min("created_at") FROM "signups" WHERE "email" <> '' AND "product" <> 'pos'
GROUP BY lower("email"), "product"
ON CONFLICT DO NOTHING;
