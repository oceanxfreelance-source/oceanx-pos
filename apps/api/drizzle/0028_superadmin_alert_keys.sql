CREATE TABLE "super_admin_alert_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"super_admin_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"device" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "super_admin_alert_keys" ADD CONSTRAINT "super_admin_alert_keys_super_admin_id_super_admins_id_fk" FOREIGN KEY ("super_admin_id") REFERENCES "public"."super_admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "super_admin_alert_keys_token_uq" ON "super_admin_alert_keys" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "super_admin_alert_keys_admin_idx" ON "super_admin_alert_keys" USING btree ("super_admin_id");