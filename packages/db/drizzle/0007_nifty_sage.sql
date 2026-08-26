CREATE TABLE "launchpoint_analytics_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"snapshot_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"accounts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"videos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pay_structures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_refreshed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "launchpoint_analytics_snapshots" ADD CONSTRAINT "launchpoint_analytics_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "launchpoint_analytics_snapshots_org_unique" ON "launchpoint_analytics_snapshots" USING btree ("organization_id");