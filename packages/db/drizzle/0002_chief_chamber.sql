CREATE TYPE "public"."script_pipeline_stage" AS ENUM('not_started', 'testing', 'iterate', 'winner', 'retired');--> statement-breakpoint
CREATE TYPE "public"."script_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."script_test_state" AS ENUM('planned', 'live', 'complete', 'stopped');--> statement-breakpoint
CREATE TABLE "script_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"script_id" uuid NOT NULL,
	"creator_id" uuid,
	"video_id" uuid,
	"state" "script_test_state" DEFAULT 'planned' NOT NULL,
	"variant_label" text DEFAULT 'A' NOT NULL,
	"creative_angle" text,
	"hypothesis" text,
	"views" integer DEFAULT 0 NOT NULL,
	"hook_rate" real,
	"average_watch_time_seconds" real,
	"conversion_rate" real,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "pipeline_stage" "script_pipeline_stage" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "priority" "script_priority" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "category" text DEFAULT 'Uncategorized' NOT NULL;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "format" text DEFAULT 'Talking head' NOT NULL;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "script_tests" ADD CONSTRAINT "script_tests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_tests" ADD CONSTRAINT "script_tests_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_tests" ADD CONSTRAINT "script_tests_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_tests" ADD CONSTRAINT "script_tests_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "script_tests_org_state_idx" ON "script_tests" USING btree ("organization_id","state","updated_at");--> statement-breakpoint
CREATE INDEX "script_tests_script_idx" ON "script_tests" USING btree ("script_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "script_tests_video_unique" ON "script_tests" USING btree ("organization_id","video_id");--> statement-breakpoint
CREATE INDEX "scripts_org_pipeline_updated_idx" ON "scripts" USING btree ("organization_id","pipeline_stage","updated_at");--> statement-breakpoint
CREATE INDEX "scripts_org_category_idx" ON "scripts" USING btree ("organization_id","category");