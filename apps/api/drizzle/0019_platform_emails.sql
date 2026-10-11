CREATE TABLE "platform_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"audience" jsonb NOT NULL,
	"recipients" jsonb NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"sent_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_emails" ADD CONSTRAINT "platform_emails_sent_by_super_admins_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_emails_created_idx" ON "platform_emails" USING btree ("created_at");