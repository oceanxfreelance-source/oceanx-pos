CREATE TYPE "public"."actor_type" AS ENUM('super_admin', 'user', 'system');--> statement-breakpoint
CREATE TYPE "public"."addon_grant_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."business_status" AS ENUM('pending', 'active', 'suspended', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."business_type" AS ENUM('restaurant', 'cafe', 'coffee_shop', 'bakery', 'fast_food', 'juice_shop', 'dessert_shop', 'takeaway', 'other');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."token_purpose" AS ENUM('reset', 'invite');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" uuid,
	"actor_name" text,
	"business_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"price_monthly" numeric(12, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"platform_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"status" "addon_grant_status" DEFAULT 'active' NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"expires_at" timestamp with time zone,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_addons_uq" UNIQUE("business_id","addon_id")
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"business_type" "business_type" NOT NULL,
	"status" "business_status" DEFAULT 'pending' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"logo_path" text,
	"currency" text DEFAULT 'MVR' NOT NULL,
	"timezone" text DEFAULT 'Indian/Maldives' NOT NULL,
	"suspension_reason" text,
	"approved_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"created_by_super_admin_id" uuid,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "document_sequences" (
	"business_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"doc_type" text NOT NULL,
	"period" text NOT NULL,
	"last_number" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_sequences_business_id_scope_doc_type_period_pk" PRIMARY KEY("business_id","scope","doc_type","period")
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outlets_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" text PRIMARY KEY NOT NULL,
	"module" text NOT NULL,
	"addon" text
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_monthly" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"modules" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_languages" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"native_name" text NOT NULL,
	"direction" text DEFAULT 'ltr' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_key" text NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_key_pk" PRIMARY KEY("role_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"system_key" text,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "subscription_status" NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"custom_limits" jsonb,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "super_admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"super_admin_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"csrf_token" text NOT NULL,
	"mfa_pending" boolean DEFAULT false NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "super_admin_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"super_admin_id" uuid NOT NULL,
	"purpose" "token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "super_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"totp_secret_enc" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"totp_last_step" integer,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_outlets" (
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	CONSTRAINT "user_outlets_user_id_outlet_id_pk" PRIMARY KEY("user_id","outlet_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"csrf_token" text NOT NULL,
	"current_outlet_id" uuid,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"password_hash" text,
	"language" text DEFAULT 'en' NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"default_outlet_id" uuid,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_addons" ADD CONSTRAINT "business_addons_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_addons" ADD CONSTRAINT "business_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_addons" ADD CONSTRAINT "business_addons_granted_by_super_admins_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_addons" ADD CONSTRAINT "business_addons_revoked_by_super_admins_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_created_by_super_admin_id_super_admins_id_fk" FOREIGN KEY ("created_by_super_admin_id") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_super_admins_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admin_sessions" ADD CONSTRAINT "super_admin_sessions_super_admin_id_super_admins_id_fk" FOREIGN KEY ("super_admin_id") REFERENCES "public"."super_admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admin_tokens" ADD CONSTRAINT "super_admin_tokens_super_admin_id_super_admins_id_fk" FOREIGN KEY ("super_admin_id") REFERENCES "public"."super_admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_outlets" ADD CONSTRAINT "user_outlets_user_fk" FOREIGN KEY ("business_id","user_id") REFERENCES "public"."users"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_outlets" ADD CONSTRAINT "user_outlets_outlet_fk" FOREIGN KEY ("business_id","outlet_id") REFERENCES "public"."outlets"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_fk" FOREIGN KEY ("business_id","user_id") REFERENCES "public"."users"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_fk" FOREIGN KEY ("business_id","role_id") REFERENCES "public"."roles"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_fk" FOREIGN KEY ("business_id","user_id") REFERENCES "public"."users"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_outlet_fk" FOREIGN KEY ("business_id","current_outlet_id") REFERENCES "public"."outlets"("business_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_outlet_fk" FOREIGN KEY ("business_id","default_outlet_id") REFERENCES "public"."outlets"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_business_created_idx" ON "activity_logs" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_actor_created_idx" ON "activity_logs" USING btree ("actor_type","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_action_idx" ON "activity_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "addons_code_uq" ON "addons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "business_addons_addon_idx" ON "business_addons" USING btree ("addon_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_slug_uq" ON "businesses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "businesses_status_idx" ON "businesses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "businesses_type_idx" ON "businesses" USING btree ("business_type");--> statement-breakpoint
CREATE INDEX "businesses_created_idx" ON "businesses" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outlets_business_name_uq" ON "outlets" USING btree ("business_id",lower("name"));--> statement-breakpoint
CREATE INDEX "outlets_business_idx" ON "outlets" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_code_uq" ON "plans" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_business_name_uq" ON "roles" USING btree ("business_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "roles_business_system_key_uq" ON "roles" USING btree ("business_id","system_key") WHERE "roles"."system_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_business_uq" ON "subscriptions" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_period_end_idx" ON "subscriptions" USING btree ("current_period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "super_admin_sessions_token_uq" ON "super_admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "super_admin_sessions_admin_idx" ON "super_admin_sessions" USING btree ("super_admin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "super_admin_tokens_token_uq" ON "super_admin_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "super_admins_email_uq" ON "super_admins" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_sessions_token_uq" ON "user_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "user_sessions_user_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tokens_token_uq" ON "user_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "user_tokens_user_idx" ON "user_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email")) WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "users_business_idx" ON "users" USING btree ("business_id");