ALTER TABLE "script_assignments" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "script_versions" ADD COLUMN "generation" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "script_assignments_share_token_unique" ON "script_assignments" USING btree ("share_token");