CREATE TYPE "public"."script_assignment_state" AS ENUM('assigned', 'viewed', 'filming', 'submitted', 'changes_requested', 'approved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."script_status" AS ENUM('draft', 'ready', 'assigned', 'in_review', 'approved', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "brand_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"product_description" text NOT NULL,
	"audience" text NOT NULL,
	"voice" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"banned_phrases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proof_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "script_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"script_id" uuid NOT NULL,
	"label" text NOT NULL,
	"kind" text NOT NULL,
	"source_url" text,
	"download_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "script_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"script_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"state" "script_assignment_state" DEFAULT 'assigned' NOT NULL,
	"due_at" timestamp with time zone,
	"message" text,
	"assigned_by_user_id" uuid,
	"discord_operation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "script_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_platform" text DEFAULT 'instagram' NOT NULL,
	"source_url" text,
	"source_creator" text,
	"transcript_state" text DEFAULT 'provided' NOT NULL,
	"transcript" text NOT NULL,
	"transcript_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "script_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"script_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"change_summary" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference_id" uuid,
	"title" text NOT NULL,
	"status" "script_status" DEFAULT 'draft' NOT NULL,
	"target_platform" text DEFAULT 'instagram' NOT NULL,
	"duration_seconds" integer,
	"hook" text,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"brand_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"latest_version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_updated_by_user_id_internal_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_assets" ADD CONSTRAINT "script_assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_assets" ADD CONSTRAINT "script_assets_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_assets" ADD CONSTRAINT "script_assets_created_by_user_id_internal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_assignments" ADD CONSTRAINT "script_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_assignments" ADD CONSTRAINT "script_assignments_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_assignments" ADD CONSTRAINT "script_assignments_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_assignments" ADD CONSTRAINT "script_assignments_assigned_by_user_id_internal_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_references" ADD CONSTRAINT "script_references_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_references" ADD CONSTRAINT "script_references_created_by_user_id_internal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_versions" ADD CONSTRAINT "script_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_versions" ADD CONSTRAINT "script_versions_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_versions" ADD CONSTRAINT "script_versions_created_by_user_id_internal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_reference_id_script_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."script_references"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_created_by_user_id_internal_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_updated_by_user_id_internal_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_profiles_org_unique" ON "brand_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "script_assets_script_created_idx" ON "script_assets" USING btree ("script_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "script_assignments_script_creator_unique" ON "script_assignments" USING btree ("script_id","creator_id");--> statement-breakpoint
CREATE INDEX "script_assignments_org_state_due_idx" ON "script_assignments" USING btree ("organization_id","state","due_at");--> statement-breakpoint
CREATE INDEX "script_assignments_creator_idx" ON "script_assignments" USING btree ("creator_id","updated_at");--> statement-breakpoint
CREATE INDEX "script_references_org_created_idx" ON "script_references" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "script_versions_script_version_unique" ON "script_versions" USING btree ("script_id","version");--> statement-breakpoint
CREATE INDEX "script_versions_org_created_idx" ON "script_versions" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "scripts_org_status_updated_idx" ON "scripts" USING btree ("organization_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "scripts_reference_idx" ON "scripts" USING btree ("reference_id");