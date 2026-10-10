CREATE TABLE "hub_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'company' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"tax_number" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"business_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"number" text NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid,
	"issue_date" text NOT NULL,
	"due_date" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'MVR' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"terms" text DEFAULT '' NOT NULL,
	"source_quote_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'other' NOT NULL,
	"service_id" uuid,
	"interest" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"next_follow_up" text,
	"assigned_to" uuid,
	"notes" text DEFAULT '' NOT NULL,
	"client_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"method" text DEFAULT 'bank_transfer' NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"paid_at" text NOT NULL,
	"voided_at" timestamp with time zone,
	"received_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"service_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"start_date" text,
	"due_date" text,
	"value" bigint DEFAULT 0 NOT NULL,
	"assigned_to" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT 'job' NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"due_date" text,
	"assigned_to" uuid,
	"created_by" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_ticket_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"client_id" uuid,
	"business_id" uuid,
	"subject" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT 'phone' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"created_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hub_clients" ADD CONSTRAINT "hub_clients_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_clients" ADD CONSTRAINT "hub_clients_created_by_super_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_documents" ADD CONSTRAINT "hub_documents_client_id_hub_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."hub_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_documents" ADD CONSTRAINT "hub_documents_project_id_hub_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."hub_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_documents" ADD CONSTRAINT "hub_documents_created_by_super_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_leads" ADD CONSTRAINT "hub_leads_service_id_hub_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."hub_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_leads" ADD CONSTRAINT "hub_leads_assigned_to_super_admins_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_leads" ADD CONSTRAINT "hub_leads_client_id_hub_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."hub_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_leads" ADD CONSTRAINT "hub_leads_created_by_super_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_payments" ADD CONSTRAINT "hub_payments_document_id_hub_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."hub_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_payments" ADD CONSTRAINT "hub_payments_received_by_super_admins_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_projects" ADD CONSTRAINT "hub_projects_client_id_hub_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."hub_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_projects" ADD CONSTRAINT "hub_projects_service_id_hub_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."hub_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_projects" ADD CONSTRAINT "hub_projects_assigned_to_super_admins_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_projects" ADD CONSTRAINT "hub_projects_created_by_super_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_tasks" ADD CONSTRAINT "hub_tasks_project_id_hub_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."hub_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_tasks" ADD CONSTRAINT "hub_tasks_assigned_to_super_admins_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_tasks" ADD CONSTRAINT "hub_tasks_created_by_super_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_ticket_notes" ADD CONSTRAINT "hub_ticket_notes_ticket_id_hub_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."hub_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_ticket_notes" ADD CONSTRAINT "hub_ticket_notes_author_id_super_admins_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_tickets" ADD CONSTRAINT "hub_tickets_client_id_hub_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."hub_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_tickets" ADD CONSTRAINT "hub_tickets_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_tickets" ADD CONSTRAINT "hub_tickets_assigned_to_super_admins_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_tickets" ADD CONSTRAINT "hub_tickets_created_by_super_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."super_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hub_clients_name_idx" ON "hub_clients" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "hub_documents_number_uq" ON "hub_documents" USING btree ("number");--> statement-breakpoint
CREATE INDEX "hub_documents_client_idx" ON "hub_documents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "hub_documents_kind_status_idx" ON "hub_documents" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "hub_leads_status_idx" ON "hub_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hub_leads_follow_up_idx" ON "hub_leads" USING btree ("next_follow_up");--> statement-breakpoint
CREATE INDEX "hub_payments_document_idx" ON "hub_payments" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "hub_projects_status_idx" ON "hub_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hub_tasks_status_idx" ON "hub_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hub_tasks_project_idx" ON "hub_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "hub_ticket_notes_ticket_idx" ON "hub_ticket_notes" USING btree ("ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hub_tickets_number_uq" ON "hub_tickets" USING btree ("number");--> statement-breakpoint
CREATE INDEX "hub_tickets_status_idx" ON "hub_tickets" USING btree ("status");