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
}, (table) => [index("creator_notes_creator_idx").on(table.creatorId, table.createdAt)]);

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
});

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
