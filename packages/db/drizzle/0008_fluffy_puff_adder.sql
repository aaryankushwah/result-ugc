CREATE TABLE "creator_warmups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"duration_days" integer DEFAULT 3 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"last_reminder_date" text,
	"started_by_discord_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_warmups" ADD CONSTRAINT "creator_warmups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_warmups" ADD CONSTRAINT "creator_warmups_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creator_warmups_creator_unique" ON "creator_warmups" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "creator_warmups_org_state_ends_idx" ON "creator_warmups" USING btree ("organization_id","state","ends_at");