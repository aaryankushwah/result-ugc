CREATE TABLE "attribution_daily_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"attribution_link_id" uuid NOT NULL,
	"bucket_at" timestamp with time zone NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"leads" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"sales" integer DEFAULT 0 NOT NULL,
	"sale_amount" integer DEFAULT 0 NOT NULL,
	"source_refreshed_at" timestamp with time zone NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_attribution_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"provider" text DEFAULT 'dub' NOT NULL,
	"provider_link_id" text NOT NULL,
	"external_id" text NOT NULL,
	"short_link" text NOT NULL,
	"destination_url" text NOT NULL,
	"link_key" text,
	"state" text DEFAULT 'active' NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"leads" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"sales" integer DEFAULT 0 NOT NULL,
	"sale_amount" integer DEFAULT 0 NOT NULL,
	"last_clicked_at" timestamp with time zone,
	"source_refreshed_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attribution_daily_snapshots" ADD CONSTRAINT "attribution_daily_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_daily_snapshots" ADD CONSTRAINT "attribution_daily_snapshots_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_daily_snapshots" ADD CONSTRAINT "attribution_daily_snapshots_attribution_link_id_creator_attribution_links_id_fk" FOREIGN KEY ("attribution_link_id") REFERENCES "public"."creator_attribution_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_attribution_links" ADD CONSTRAINT "creator_attribution_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_attribution_links" ADD CONSTRAINT "creator_attribution_links_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attribution_daily_snapshots_link_bucket_unique" ON "attribution_daily_snapshots" USING btree ("attribution_link_id","bucket_at");--> statement-breakpoint
CREATE INDEX "attribution_daily_snapshots_org_bucket_idx" ON "attribution_daily_snapshots" USING btree ("organization_id","bucket_at");--> statement-breakpoint
CREATE INDEX "attribution_daily_snapshots_creator_bucket_idx" ON "attribution_daily_snapshots" USING btree ("creator_id","bucket_at");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_attribution_links_creator_unique" ON "creator_attribution_links" USING btree ("organization_id","creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_attribution_links_provider_id_unique" ON "creator_attribution_links" USING btree ("organization_id","provider","provider_link_id");