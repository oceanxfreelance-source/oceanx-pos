ALTER TABLE "payments" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "balance_after" bigint;--> statement-breakpoint
CREATE INDEX "payments_group_idx" ON "payments" USING btree ("group_id");