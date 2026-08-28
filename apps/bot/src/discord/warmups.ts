import { Colors, EmbedBuilder, type Client } from "discord.js";
import {
  activityEvents,
  creatorDiscord,
  creators,
  creatorWarmups,
  discordOperations,
  getDatabase,
  hasDatabase,
  organizations,
} from "@result/db";
import { warmupDaysLeft, warmupEndAt, warmupReminderDate } from "@result/domain";
import { and, eq } from "drizzle-orm";

export type ActiveWarmup = {
  id: string;
  organizationId: string;
  creatorId: string;
  displayName: string;
  discordUserId: string | null;
  durationDays: number;
  startedAt: Date;
  endsAt: Date;
  daysLeft: number;
  lastReminderDate: string | null;
};

export type StartWarmupResult =
  | { state: "started"; warmup: ActiveWarmup }
  | { state: "database_unavailable" | "organization_unavailable" | "creator_unavailable" };

async function organizationForGuild(guildId: string): Promise<{ id: string } | null> {
  if (!hasDatabase()) return null;
  return (await getDatabase()
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.slug, "result"), eq(organizations.discordGuildId, guildId)))
    .limit(1))[0] ?? null;
}

async function warmupRowsForGuild(guildId: string, now: Date): Promise<ActiveWarmup[]> {
  const organization = await organizationForGuild(guildId);
  if (!organization) return [];
  const rows = await getDatabase()
    .select({
      id: creatorWarmups.id,
      organizationId: creatorWarmups.organizationId,
      creatorId: creatorWarmups.creatorId,
      displayName: creators.displayName,
      discordUserId: creatorDiscord.discordUserId,
      durationDays: creatorWarmups.durationDays,
      startedAt: creatorWarmups.startedAt,
      endsAt: creatorWarmups.endsAt,
      lastReminderDate: creatorWarmups.lastReminderDate,
    })
    .from(creatorWarmups)
    .innerJoin(creators, and(
      eq(creators.id, creatorWarmups.creatorId),
      eq(creators.organizationId, creatorWarmups.organizationId),
    ))
    .leftJoin(creatorDiscord, and(
      eq(creatorDiscord.creatorId, creatorWarmups.creatorId),
      eq(creatorDiscord.organizationId, creatorWarmups.organizationId),
      eq(creatorDiscord.guildId, guildId),
    ))
    .where(and(
      eq(creatorWarmups.organizationId, organization.id),
      eq(creatorWarmups.state, "active"),
    ));
  return rows.map((row) => ({ ...row, daysLeft: warmupDaysLeft(row.endsAt, now) }));
}

export async function startCreatorWarmup(input: {
  guildId: string;
  discordUserId: string;
  durationDays: number;
  startedByDiscordUserId: string;
  now?: Date;
}): Promise<StartWarmupResult> {
  if (!hasDatabase()) return { state: "database_unavailable" };
  const organization = await organizationForGuild(input.guildId);
  if (!organization) return { state: "organization_unavailable" };
  const connection = (await getDatabase()
    .select({ creatorId: creatorDiscord.creatorId, displayName: creators.displayName })
    .from(creatorDiscord)
    .innerJoin(creators, and(
      eq(creators.id, creatorDiscord.creatorId),
      eq(creators.organizationId, creatorDiscord.organizationId),
    ))
    .where(and(
      eq(creatorDiscord.organizationId, organization.id),
      eq(creatorDiscord.guildId, input.guildId),
      eq(creatorDiscord.discordUserId, input.discordUserId),
    ))
    .limit(1))[0];
  if (!connection) return { state: "creator_unavailable" };

  const now = input.now ?? new Date();
  const endsAt = warmupEndAt(now, input.durationDays);
  const previous = (await getDatabase()
    .select({ state: creatorWarmups.state, endsAt: creatorWarmups.endsAt })
    .from(creatorWarmups)
    .where(and(
      eq(creatorWarmups.organizationId, organization.id),
      eq(creatorWarmups.creatorId, connection.creatorId),
    ))
    .limit(1))[0];
  const [warmup] = await getDatabase().transaction(async (tx) => {
    const rows = await tx.insert(creatorWarmups).values({
      organizationId: organization.id,
      creatorId: connection.creatorId,
      state: "active",
      durationDays: input.durationDays,
      startedAt: now,
      endsAt,
      completedAt: null,
      lastReminderDate: warmupReminderDate(now),
      startedByDiscordUserId: input.startedByDiscordUserId,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: creatorWarmups.creatorId,
      set: {
        state: "active",
        durationDays: input.durationDays,
        startedAt: now,
        endsAt,
        completedAt: null,
        lastReminderDate: warmupReminderDate(now),
        startedByDiscordUserId: input.startedByDiscordUserId,
        updatedAt: now,
      },
    }).returning({
      id: creatorWarmups.id,
      organizationId: creatorWarmups.organizationId,
      creatorId: creatorWarmups.creatorId,
      durationDays: creatorWarmups.durationDays,
      startedAt: creatorWarmups.startedAt,
      endsAt: creatorWarmups.endsAt,
      lastReminderDate: creatorWarmups.lastReminderDate,
    });
    await tx.insert(activityEvents).values({
      organizationId: organization.id,
      creatorId: connection.creatorId,
      actorDiscordUserId: input.startedByDiscordUserId,
      type: previous ? "creator.warmup_restarted" : "creator.warmup_started",
      summary: `A ${input.durationDays}-day warmup was started for ${connection.displayName}.`,
      metadata: {
        durationDays: input.durationDays,
        startedAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        previousState: previous?.state ?? null,
        previousEndsAt: previous?.endsAt.toISOString() ?? null,
      },
    });
    return rows;
  });
  if (!warmup) throw new Error("Warmup could not be saved");
  return {
    state: "started",
    warmup: {
      ...warmup,
      displayName: connection.displayName,
      discordUserId: input.discordUserId,
      daysLeft: warmupDaysLeft(warmup.endsAt, now),
    },
  };
}

export async function activeWarmupsForGuild(guildId: string, now = new Date()): Promise<ActiveWarmup[] | null> {
  if (!hasDatabase() || !await organizationForGuild(guildId)) return null;
  return (await warmupRowsForGuild(guildId, now))
    .filter((warmup) => warmup.daysLeft > 0)
    .sort((left, right) => left.daysLeft - right.daysLeft || left.displayName.localeCompare(right.displayName));
}

export function buildWarmupReminderMessage(warmup: Pick<ActiveWarmup, "discordUserId" | "daysLeft">): string {
  const days = warmup.daysLeft;
  return [
    `**Warmup check-in**${warmup.discordUserId ? ` · <@${warmup.discordUserId}>` : ""}`,
    `You have **${days} day${days === 1 ? "" : "s"} left** in your warmup.`,
    "Keep posting naturally and building account activity — the Result team is tracking your progress.",
  ].join("\n");
}

export function buildWarmupCompletionMessage(warmup: Pick<ActiveWarmup, "discordUserId" | "durationDays">): string {
  return `**Warmup complete**${warmup.discordUserId ? ` · <@${warmup.discordUserId}>` : ""}\nYour **${warmup.durationDays}-day warmup** is complete. The Result team can now review your progress.`;
}

export function buildWarmupDetailsEmbed(warmups: ActiveWarmup[]): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Colors.Blurple).setTitle("Creator warmups").setTimestamp();
  if (!warmups.length) return embed.setDescription("No creators are currently in warmup.");
  const lines: string[] = [];
  for (const warmup of warmups) {
    const endTimestamp = Math.floor(warmup.endsAt.getTime() / 1_000);
    const line = [
      `**${warmup.displayName}** — **${warmup.daysLeft} day${warmup.daysLeft === 1 ? "" : "s"} left**`,
      `${warmup.discordUserId ? `<@${warmup.discordUserId}> · ` : ""}ends <t:${endTimestamp}:D>`,
    ].join("\n");
    if ([...lines, line].join("\n\n").length > 3_800) break;
    lines.push(line);
  }
  return embed
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: `${warmups.length} active creator${warmups.length === 1 ? "" : "s"} · daily private-channel reminders` });
}

async function completeWarmup(guildId: string, warmup: ActiveWarmup, now: Date): Promise<void> {
  await getDatabase().transaction(async (tx) => {
    const [completed] = await tx.update(creatorWarmups).set({
      state: "completed",
      completedAt: now,
      updatedAt: now,
    }).where(and(
      eq(creatorWarmups.id, warmup.id),
      eq(creatorWarmups.organizationId, warmup.organizationId),
      eq(creatorWarmups.state, "active"),
    )).returning({ id: creatorWarmups.id });
    if (!completed) return;
    await tx.insert(activityEvents).values({
      organizationId: warmup.organizationId,
      creatorId: warmup.creatorId,
      type: "creator.warmup_completed",
      summary: `${warmup.displayName} completed their ${warmup.durationDays}-day warmup.`,
      metadata: { durationDays: warmup.durationDays, startedAt: warmup.startedAt.toISOString(), endsAt: warmup.endsAt.toISOString() },
    });
    if (!warmup.discordUserId) return;
    await tx.insert(discordOperations).values({
      organizationId: warmup.organizationId,
      creatorId: warmup.creatorId,
      guildId,
      type: "send_warmup_complete",
      idempotencyKey: `warmup_complete:${warmup.id}:${warmup.startedAt.toISOString()}`,
      payload: {
        warmupId: warmup.id,
        startedAt: warmup.startedAt.toISOString(),
        durationDays: warmup.durationDays,
        discordUserId: warmup.discordUserId,
      },
    }).onConflictDoNothing();
  });
}

async function enqueueWarmupReminder(guildId: string, warmup: ActiveWarmup, now: Date): Promise<void> {
  const today = warmupReminderDate(now);
  if (warmup.lastReminderDate === today || !warmup.discordUserId) return;
  await getDatabase().insert(discordOperations).values({
    organizationId: warmup.organizationId,
    creatorId: warmup.creatorId,
    guildId,
    type: "send_warmup_reminder",
    idempotencyKey: `warmup_reminder:${warmup.id}:${warmup.startedAt.toISOString()}:${today}`,
    payload: {
      warmupId: warmup.id,
      startedAt: warmup.startedAt.toISOString(),
      reminderDate: today,
      daysLeft: warmup.daysLeft,
      discordUserId: warmup.discordUserId,
    },
  }).onConflictDoNothing();
}

export async function runWarmupReminderSweep(client: Client, now = new Date()): Promise<void> {
  if (!hasDatabase()) return;
  for (const guild of client.guilds.cache.values()) {
    const warmups = await warmupRowsForGuild(guild.id, now);
    const results = await Promise.allSettled(warmups.map((warmup) => warmup.daysLeft <= 0
      ? completeWarmup(guild.id, warmup, now)
      : enqueueWarmupReminder(guild.id, warmup, now)));
    results.forEach((result, index) => {
      if (result.status === "rejected") console.error(`Warmup reminder failed for ${guild.id}/${warmups[index]?.creatorId}:`, result.reason);
    });
  }
}
