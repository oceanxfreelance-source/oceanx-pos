CREATE TABLE "hub_ventures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'custom' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" text DEFAULT 'blue' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "hub_clients" ADD COLUMN "venture_id" uuid;--> statement-breakpoint
ALTER TABLE "hub_documents" ADD COLUMN "venture_id" uuid;--> statement-breakpoint
ALTER TABLE "hub_leads" ADD COLUMN "venture_id" uuid;--> statement-breakpoint
ALTER TABLE "hub_projects" ADD COLUMN "venture_id" uuid;--> statement-breakpoint
ALTER TABLE "hub_services" ADD COLUMN "venture_id" uuid;--> statement-breakpoint
ALTER TABLE "hub_tasks" ADD COLUMN "venture_id" uuid;--> statement-breakpoint
ALTER TABLE "hub_tickets" ADD COLUMN "venture_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "hub_ventures_pos_uq" ON "hub_ventures" USING btree ("kind") WHERE "hub_ventures"."kind" = 'pos';--> statement-breakpoint
ALTER TABLE "hub_clients" ADD CONSTRAINT "hub_clients_venture_id_hub_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."hub_ventures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_documents" ADD CONSTRAINT "hub_documents_venture_id_hub_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."hub_ventures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_leads" ADD CONSTRAINT "hub_leads_venture_id_hub_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."hub_ventures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_projects" ADD CONSTRAINT "hub_projects_venture_id_hub_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."hub_ventures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_services" ADD CONSTRAINT "hub_services_venture_id_hub_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."hub_ventures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_tasks" ADD CONSTRAINT "hub_tasks_venture_id_hub_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."hub_ventures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_tickets" ADD CONSTRAINT "hub_tickets_venture_id_hub_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."hub_ventures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "hub_ventures" ("name", "kind", "description", "color", "sort_order") VALUES ('OceanX POS', 'pos', 'POS for restaurants, cafés, shops and supermarkets.', 'blue', 0) ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "hub_services" SET "venture_id" = (SELECT "id" FROM "hub_ventures" WHERE "kind" = 'pos') WHERE "category" = 'pos' AND "venture_id" IS NULL;--> statement-breakpoint
UPDATE "hub_tickets" SET "venture_id" = (SELECT "id" FROM "hub_ventures" WHERE "kind" = 'pos') WHERE "business_id" IS NOT NULL AND "venture_id" IS NULL;