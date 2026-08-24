CREATE TYPE "public"."creator_lifecycle" AS ENUM('request', 'active', 'watch', 'offboarded');--> statement-breakpoint
CREATE TYPE "public"."discord_state" AS ENUM('connected', 'missing_access', 'applicant', 'left', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."account_link_state" AS ENUM('suggested', 'confirmed', 'unlinked');--> statement-breakpoint
CREATE TYPE "public"."operation_state" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."provider_sync_mode" AS ENUM('api', 'manual');--> statement-breakpoint
CREATE TYPE "public"."relationship_state" AS ENUM('unlinked', 'pending', 'signed_upcoming', 'signed_active', 'expiring', 'inactive', 'sync_issue');--> statement-breakpoint
CREATE TYPE "public"."signing_provider" AS ENUM('launchpoint', 'sideshift', 'other');--> statement-breakpoint
CREATE TYPE "public"."tracking_state" AS ENUM('healthy', 'stale', 'failed', 'pending', 'untracked');--> statement-breakpoint
CREATE TYPE "public"."internal_user_role" AS ENUM('admin', 'ugc_manager', 'viewer');--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"creator_id" uuid,
	"actor_user_id" uuid,
	"actor_discord_user_id" text,
	"type" text NOT NULL,
	"summary" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_discord" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"guild_id" text NOT NULL,
	"discord_user_id" text,
	"username" text,
	"display_name" text,
	"avatar_url" text,
	"state" "discord_state" DEFAULT 'unknown' NOT NULL,
	"role_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"private_channel_id" text,
	"last_reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"author_user_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"phone" text,
	"lifecycle" "creator_lifecycle" DEFAULT 'request' NOT NULL,
	"attention_state" text,
	"next_step" text,
	"manager_user_id" uuid,
	"offboard_reason" text,
	"offboarded_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"creator_id" uuid,
	"guild_id" text NOT NULL,
	"type" text NOT NULL,
	"state" "operation_state" DEFAULT 'queued' NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requested_by_user_id" uuid,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"last_error" text,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"discord_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"role" "internal_user_role" DEFAULT 'viewer' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy_guild_states" (
	"guild_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legacy_guild_states_guild_id_organization_id_pk" PRIMARY KEY("guild_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"discord_guild_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signing_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"provider" "signing_provider" NOT NULL,
	"sync_mode" "provider_sync_mode" NOT NULL,
	"external_id" text,
	"program" text,
	"state" "relationship_state" DEFAULT 'pending' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"source_url" text,
	"verification_method" text,
	"verified_by_user_id" uuid,
	"verified_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"creator_id" uuid,
	"viral_org_account_id" text NOT NULL,
	"platform" text NOT NULL,
	"platform_account_id" text NOT NULL,
	"username" text,
	"display_name" text,
	"avatar_url" text,
	"link_state" "account_link_state" DEFAULT 'unlinked' NOT NULL,
	"suggested_creator_id" uuid,
	"link_confidence" real,
	"linked_by_user_id" uuid,
	"linked_at" timestamp with time zone,
	"tracking_state" "tracking_state" DEFAULT 'pending' NOT NULL,
	"followers" integer,
	"following" integer,
	"posts" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"bookmarks" integer DEFAULT 0 NOT NULL,
	"average_views" integer,
	"engagement_rate" real,
	"latest_post_at" timestamp with time zone,
	"source_refreshed_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source" text NOT NULL,
	"state" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"records_seen" integer,
	"records_changed" integer,
	"error" text,
	"cursor" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"viral_video_id" text NOT NULL,
	"platform_video_id" text NOT NULL,
	"caption" text,
	"thumbnail_url" text,
	"duration_seconds" integer,
	"published_at" timestamp with time zone,
	"views" integer DEFAULT 0 NOT NULL,
	"organic_views" integer,
	"paid_views" integer,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"bookmarks" integer DEFAULT 0 NOT NULL,
	"engagement_rate" real,
	"baseline_multiplier" real,
	"included" boolean DEFAULT true NOT NULL,
	"exclusion_reason" text,
	"excluded_at" timestamp with time zone,
	"excluded_by_user_id" uuid,
	"tracking_state" "tracking_state" DEFAULT 'pending' NOT NULL,
	"source_refreshed_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_user_id_internal_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_discord" ADD CONSTRAINT "creator_discord_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_discord" ADD CONSTRAINT "creator_discord_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_notes" ADD CONSTRAINT "creator_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_notes" ADD CONSTRAINT "creator_notes_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_notes" ADD CONSTRAINT "creator_notes_author_user_id_internal_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creators" ADD CONSTRAINT "creators_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creators" ADD CONSTRAINT "creators_manager_user_id_internal_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_operations" ADD CONSTRAINT "discord_operations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_operations" ADD CONSTRAINT "discord_operations_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_operations" ADD CONSTRAINT "discord_operations_requested_by_user_id_internal_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_users" ADD CONSTRAINT "internal_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_guild_states" ADD CONSTRAINT "legacy_guild_states_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_relationships" ADD CONSTRAINT "signing_relationships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_relationships" ADD CONSTRAINT "signing_relationships_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_relationships" ADD CONSTRAINT "signing_relationships_verified_by_user_id_internal_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_suggested_creator_id_creators_id_fk" FOREIGN KEY ("suggested_creator_id") REFERENCES "public"."creators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_linked_by_user_id_internal_users_id_fk" FOREIGN KEY ("linked_by_user_id") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_excluded_by_user_id_internal_users_id_fk" FOREIGN KEY ("excluded_by_user_id") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_org_occurred_idx" ON "activity_events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_discord_creator_unique" ON "creator_discord" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_discord_member_unique" ON "creator_discord" USING btree ("organization_id","guild_id","discord_user_id");--> statement-breakpoint
CREATE INDEX "creator_notes_creator_idx" ON "creator_notes" USING btree ("creator_id","created_at");--> statement-breakpoint
CREATE INDEX "creators_org_lifecycle_idx" ON "creators" USING btree ("organization_id","lifecycle");--> statement-breakpoint
CREATE UNIQUE INDEX "discord_operations_idempotency_unique" ON "discord_operations" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "discord_operations_queue_idx" ON "discord_operations" USING btree ("guild_id","state","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "internal_users_org_discord_unique" ON "internal_users" USING btree ("organization_id","discord_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "relationships_creator_idx" ON "signing_relationships" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "relationships_provider_external_unique" ON "signing_relationships" USING btree ("organization_id","provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_viral_unique" ON "social_accounts" USING btree ("organization_id","viral_org_account_id");--> statement-breakpoint
CREATE INDEX "social_accounts_creator_idx" ON "social_accounts" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "videos_viral_unique" ON "videos" USING btree ("organization_id","viral_video_id");--> statement-breakpoint
CREATE INDEX "videos_account_published_idx" ON "videos" USING btree ("account_id","published_at");