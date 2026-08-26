import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const creatorLifecycleEnum = pgEnum("creator_lifecycle", ["request", "active", "watch", "offboarded"]);
export const discordStateEnum = pgEnum("discord_state", ["connected", "missing_access", "applicant", "left", "unknown"]);
export const signingProviderEnum = pgEnum("signing_provider", ["launchpoint", "sideshift", "other"]);
export const providerSyncModeEnum = pgEnum("provider_sync_mode", ["api", "manual"]);
export const relationshipStateEnum = pgEnum("relationship_state", ["unlinked", "pending", "signed_upcoming", "signed_active", "expiring", "inactive", "sync_issue"]);
export const trackingStateEnum = pgEnum("tracking_state", ["healthy", "stale", "failed", "pending", "untracked"]);
export const linkStateEnum = pgEnum("account_link_state", ["suggested", "confirmed", "unlinked"]);
export const operationStateEnum = pgEnum("operation_state", ["queued", "running", "succeeded", "failed"]);
export const userRoleEnum = pgEnum("internal_user_role", ["admin", "ugc_manager", "viewer"]);
export const scriptStatusEnum = pgEnum("script_status", ["draft", "ready", "assigned", "in_review", "approved", "published", "archived"]);
export const scriptAssignmentStateEnum = pgEnum("script_assignment_state", ["assigned", "viewed", "filming", "submitted", "changes_requested", "approved", "cancelled"]);
export const scriptPipelineStageEnum = pgEnum("script_pipeline_stage", ["not_started", "testing", "iterate", "winner", "retired"]);
export const scriptPriorityEnum = pgEnum("script_priority", ["low", "medium", "high"]);
export const scriptTestStateEnum = pgEnum("script_test_state", ["planned", "live", "complete", "stopped"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  discordGuildId: text("discord_guild_id"),
  ...timestamps,
}, (table) => [uniqueIndex("organizations_slug_unique").on(table.slug)]);

export const internalUsers = pgTable("internal_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  discordUserId: text("discord_user_id").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").notNull().default("viewer"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("internal_users_org_discord_unique").on(table.organizationId, table.discordUserId)]);

export const creators = pgTable("creators", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  lifecycle: creatorLifecycleEnum("lifecycle").notNull().default("request"),
  attentionState: text("attention_state"),
  nextStep: text("next_step"),
  managerUserId: uuid("manager_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
  offboardReason: text("offboard_reason"),
  offboardedAt: timestamp("offboarded_at", { withTimezone: true }),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (table) => [index("creators_org_lifecycle_idx").on(table.organizationId, table.lifecycle)]);

export const creatorDiscord = pgTable("creator_discord", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id").notNull().references(() => creators.id, { onDelete: "cascade" }),
  guildId: text("guild_id").notNull(),
  discordUserId: text("discord_user_id"),
  username: text("username"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  state: discordStateEnum("state").notNull().default("unknown"),
  roleIds: jsonb("role_ids").$type<string[]>().notNull().default([]),
  privateChannelId: text("private_channel_id"),
  lastReconciledAt: timestamp("last_reconciled_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("creator_discord_creator_unique").on(table.creatorId),
  uniqueIndex("creator_discord_member_unique").on(table.organizationId, table.guildId, table.discordUserId),
]);

export const signingRelationships = pgTable("signing_relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id").notNull().references(() => creators.id, { onDelete: "cascade" }),
  provider: signingProviderEnum("provider").notNull(),
  syncMode: providerSyncModeEnum("sync_mode").notNull(),
  externalId: text("external_id"),
  program: text("program"),
  state: relationshipStateEnum("state").notNull().default("pending"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  sourceUrl: text("source_url"),
  verificationMethod: text("verification_method"),
  verifiedByUserId: uuid("verified_by_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastError: text("last_error"),
  raw: jsonb("raw").$type<Record<string, unknown>>(),
  ...timestamps,
}, (table) => [
  index("relationships_creator_idx").on(table.creatorId),
  uniqueIndex("relationships_provider_external_unique").on(table.organizationId, table.provider, table.externalId),
]);

export const socialAccounts = pgTable("social_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id").references(() => creators.id, { onDelete: "set null" }),
  viralOrgAccountId: text("viral_org_account_id").notNull(),
  platform: text("platform").notNull(),
  platformAccountId: text("platform_account_id").notNull(),
  username: text("username"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  linkState: linkStateEnum("link_state").notNull().default("unlinked"),
  suggestedCreatorId: uuid("suggested_creator_id").references(() => creators.id, { onDelete: "set null" }),
  linkConfidence: real("link_confidence"),
  linkedByUserId: uuid("linked_by_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
  linkedAt: timestamp("linked_at", { withTimezone: true }),
  trackingState: trackingStateEnum("tracking_state").notNull().default("pending"),
  followers: integer("followers"),
  following: integer("following"),
  posts: integer("posts").notNull().default(0),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  bookmarks: integer("bookmarks").notNull().default(0),
  averageViews: integer("average_views"),
  engagementRate: real("engagement_rate"),
  latestPostAt: timestamp("latest_post_at", { withTimezone: true }),
  sourceRefreshedAt: timestamp("source_refreshed_at", { withTimezone: true }),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  lastError: text("last_error"),
  raw: jsonb("raw").$type<Record<string, unknown>>(),
  ...timestamps,
}, (table) => [
  uniqueIndex("social_accounts_viral_unique").on(table.organizationId, table.viralOrgAccountId),
  index("social_accounts_creator_idx").on(table.creatorId),
]);

export const creatorAttributionLinks = pgTable("creator_attribution_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id").notNull().references(() => creators.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("dub"),
  providerLinkId: text("provider_link_id").notNull(),
  externalId: text("external_id").notNull(),
  shortLink: text("short_link").notNull(),
  destinationUrl: text("destination_url").notNull(),
  linkKey: text("link_key"),
  state: text("state").notNull().default("active"),
  clicks: integer("clicks").notNull().default(0),
  leads: integer("leads").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  sales: integer("sales").notNull().default(0),
  saleAmount: integer("sale_amount").notNull().default(0),
  lastClickedAt: timestamp("last_clicked_at", { withTimezone: true }),
  discordDeliveredAt: timestamp("discord_delivered_at", { withTimezone: true }),
  sourceRefreshedAt: timestamp("source_refreshed_at", { withTimezone: true }),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  lastError: text("last_error"),
  raw: jsonb("raw").$type<Record<string, unknown>>(),
  ...timestamps,
}, (table) => [
  uniqueIndex("creator_attribution_links_creator_unique").on(table.organizationId, table.creatorId),
  uniqueIndex("creator_attribution_links_provider_id_unique").on(table.organizationId, table.provider, table.providerLinkId),
]);

export const attributionDailySnapshots = pgTable("attribution_daily_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id").notNull().references(() => creators.id, { onDelete: "cascade" }),
  attributionLinkId: uuid("attribution_link_id").notNull().references(() => creatorAttributionLinks.id, { onDelete: "cascade" }),
  bucketAt: timestamp("bucket_at", { withTimezone: true }).notNull(),
  clicks: integer("clicks").notNull().default(0),
  leads: integer("leads").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  sales: integer("sales").notNull().default(0),
  saleAmount: integer("sale_amount").notNull().default(0),
  sourceRefreshedAt: timestamp("source_refreshed_at", { withTimezone: true }).notNull(),
  raw: jsonb("raw").$type<Record<string, unknown>>(),
  ...timestamps,
}, (table) => [
  uniqueIndex("attribution_daily_snapshots_link_bucket_unique").on(table.attributionLinkId, table.bucketAt),
  index("attribution_daily_snapshots_org_bucket_idx").on(table.organizationId, table.bucketAt),
  index("attribution_daily_snapshots_creator_bucket_idx").on(table.creatorId, table.bucketAt),
]);

export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => socialAccounts.id, { onDelete: "cascade" }),
  viralVideoId: text("viral_video_id").notNull(),
  platformVideoId: text("platform_video_id").notNull(),
  caption: text("caption"),
  thumbnailUrl: text("thumbnail_url"),
  durationSeconds: integer("duration_seconds"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  views: integer("views").notNull().default(0),
  organicViews: integer("organic_views"),
  paidViews: integer("paid_views"),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  bookmarks: integer("bookmarks").notNull().default(0),
  engagementRate: real("engagement_rate"),
  baselineMultiplier: real("baseline_multiplier"),
  included: boolean("included").notNull().default(true),
  exclusionReason: text("exclusion_reason"),
  excludedAt: timestamp("excluded_at", { withTimezone: true }),
  excludedByUserId: uuid("excluded_by_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
  trackingState: trackingStateEnum("tracking_state").notNull().default("pending"),
  sourceRefreshedAt: timestamp("source_refreshed_at", { withTimezone: true }),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  lastError: text("last_error"),
  raw: jsonb("raw").$type<Record<string, unknown>>(),
  ...timestamps,
}, (table) => [
  uniqueIndex("videos_viral_unique").on(table.organizationId, table.viralVideoId),
  index("videos_account_published_idx").on(table.accountId, table.publishedAt),
]);

export const creatorNotes = pgTable("creator_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id").notNull().references(() => creators.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  ...timestamps,
}, (table) => [
  index("creator_notes_creator_idx").on(table.creatorId, table.createdAt),
  index("creator_notes_org_created_idx").on(table.organizationId, table.createdAt),
]);

export type ScriptSection = {
  id: string;
  label: string;
  timecode: string;
  delivery: string;
  copy: string;
  visualDirection: string;
  assetIds: string[];
  blockType?: "text" | "heading_1" | "heading_2" | "heading_3" | "beat" | "direction" | "dialogue" | "bullet" | "quote" | "divider";
};

export type TranscriptSection = {
  id: string;
  label: string;
  timecode: string;
  text: string;
};

export type ScriptSubstitution = {
  sectionId: string;
  from: string;
  to: string;
};

export type ScriptGeneration = {
  model: string;
  promptVersion: string;
  referenceId: string | null;
  substitutions: ScriptSubstitution[];
};

export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  productDescription: text("product_description").notNull(),
  audience: text("audience").notNull(),
  voice: jsonb("voice").$type<string[]>().notNull().default([]),
  bannedPhrases: jsonb("banned_phrases").$type<string[]>().notNull().default([]),
  proofPoints: jsonb("proof_points").$type<string[]>().notNull().default([]),
  updatedByUserId: uuid("updated_by_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [uniqueIndex("brand_profiles_org_unique").on(table.organizationId)]);

export const scriptReferences = pgTable("script_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sourcePlatform: text("source_platform").notNull().default("instagram"),
  sourceUrl: text("source_url"),
  sourceCreator: text("source_creator"),
  transcriptState: text("transcript_state").notNull().default("provided"),
  transcript: text("transcript").notNull(),
  transcriptSections: jsonb("transcript_sections").$type<TranscriptSection[]>().notNull().default([]),
  sourceMetadata: jsonb("source_metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdByUserId: uuid("created_by_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [index("script_references_org_created_idx").on(table.organizationId, table.createdAt)]);

export const scripts = pgTable("scripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  referenceId: uuid("reference_id").references(() => scriptReferences.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  status: scriptStatusEnum("status").notNull().default("draft"),
  pipelineStage: scriptPipelineStageEnum("pipeline_stage").notNull().default("not_started"),
  priority: scriptPriorityEnum("priority").notNull().default("medium"),
  category: text("category").notNull().default("Uncategorized"),
  format: text("format").notNull().default("Talking head"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  targetPlatform: text("target_platform").notNull().default("instagram"),
  durationSeconds: integer("duration_seconds"),
  hook: text("hook"),
  sections: jsonb("sections").$type<ScriptSection[]>().notNull().default([]),
  brandSnapshot: jsonb("brand_snapshot").$type<Record<string, unknown>>().notNull().default({}),
  latestVersion: integer("latest_version").notNull().default(1),
  createdByUserId: uuid("created_by_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
  updatedByUserId: uuid("updated_by_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [
  index("scripts_org_status_updated_idx").on(table.organizationId, table.status, table.updatedAt),
  index("scripts_org_pipeline_updated_idx").on(table.organizationId, table.pipelineStage, table.updatedAt),
  index("scripts_org_category_idx").on(table.organizationId, table.category),
  index("scripts_reference_idx").on(table.referenceId),
]);

export const scriptVersions = pgTable("script_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  scriptId: uuid("script_id").notNull().references(() => scripts.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  sections: jsonb("sections").$type<ScriptSection[]>().notNull().default([]),
  changeSummary: text("change_summary"),
  generation: jsonb("generation").$type<ScriptGeneration>(),
  createdByUserId: uuid("created_by_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("script_versions_script_version_unique").on(table.scriptId, table.version),
  index("script_versions_org_created_idx").on(table.organizationId, table.createdAt),
]);

export const scriptAssignments = pgTable("script_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  scriptId: uuid("script_id").notNull().references(() => scripts.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id").notNull().references(() => creators.id, { onDelete: "cascade" }),
  state: scriptAssignmentStateEnum("state").notNull().default("assigned"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  message: text("message"),
  assignedByUserId: uuid("assigned_by_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
  discordOperationId: uuid("discord_operation_id"),
  shareToken: text("share_token"),
  ...timestamps,
}, (table) => [
  uniqueIndex("script_assignments_script_creator_unique").on(table.scriptId, table.creatorId),
  index("script_assignments_org_state_due_idx").on(table.organizationId, table.state, table.dueAt),
  index("script_assignments_creator_idx").on(table.creatorId, table.updatedAt),
  uniqueIndex("script_assignments_share_token_unique").on(table.shareToken),
]);

export const scriptAssets = pgTable("script_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  scriptId: uuid("script_id").notNull().references(() => scripts.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  kind: text("kind").notNull(),
  sourceUrl: text("source_url"),
  downloadUrl: text("download_url"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdByUserId: uuid("created_by_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [index("script_assets_script_created_idx").on(table.scriptId, table.createdAt)]);

export const scriptTests = pgTable("script_tests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  scriptId: uuid("script_id").notNull().references(() => scripts.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id").references(() => creators.id, { onDelete: "set null" }),
  videoId: uuid("video_id").references(() => videos.id, { onDelete: "set null" }),
  state: scriptTestStateEnum("state").notNull().default("planned"),
  variantLabel: text("variant_label").notNull().default("A"),
  creativeAngle: text("creative_angle"),
  hypothesis: text("hypothesis"),
  views: integer("views").notNull().default(0),
  hookRate: real("hook_rate"),
  averageWatchTimeSeconds: real("average_watch_time_seconds"),
  conversionRate: real("conversion_rate"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index("script_tests_org_state_idx").on(table.organizationId, table.state, table.updatedAt),
  index("script_tests_script_idx").on(table.scriptId, table.createdAt),
  uniqueIndex("script_tests_video_unique").on(table.organizationId, table.videoId),
]);

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id").references(() => creators.id, { onDelete: "set null" }),
  actorUserId: uuid("actor_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
  actorDiscordUserId: text("actor_discord_user_id"),
  type: text("type").notNull(),
  summary: text("summary").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("activity_org_occurred_idx").on(table.organizationId, table.occurredAt)]);

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  state: text("state").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  recordsSeen: integer("records_seen"),
  recordsChanged: integer("records_changed"),
  error: text("error"),
  cursor: text("cursor"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => [index("sync_runs_org_started_idx").on(table.organizationId, table.startedAt)]);

export const discordOperations = pgTable("discord_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id").references(() => creators.id, { onDelete: "set null" }),
  guildId: text("guild_id").notNull(),
  type: text("type").notNull(),
  state: operationStateEnum("state").notNull().default("queued"),
  idempotencyKey: text("idempotency_key").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  requestedByUserId: uuid("requested_by_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  lastError: text("last_error"),
  result: jsonb("result").$type<Record<string, unknown>>(),
  ...timestamps,
}, (table) => [
  uniqueIndex("discord_operations_idempotency_unique").on(table.organizationId, table.idempotencyKey),
  index("discord_operations_queue_idx").on(table.guildId, table.state, table.availableAt),
]);

export const legacyGuildStates = pgTable("legacy_guild_states", {
  guildId: text("guild_id").notNull(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  state: jsonb("state").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.guildId, table.organizationId] })]);
