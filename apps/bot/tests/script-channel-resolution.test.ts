import { describe, expect, it, vi } from "vitest";
import type { Guild, GuildMember, TextChannel } from "discord.js";
import { resolveCreatorChannel, type ChannelResolverDeps } from "../src/discord/script-delivery.js";

function textChannel(id: string, isThread = false): TextChannel {
  return { id, isTextBased: () => true, isThread: () => isThread } as unknown as TextChannel;
}

function fakeGuild(options: { fetchChannel?: unknown; member?: unknown }): Guild {
  return {
    channels: { fetch: vi.fn(async () => { if (options.fetchChannel === undefined) throw new Error("unknown channel"); return options.fetchChannel; }) },
    members: { fetch: vi.fn(async () => { if (options.member === undefined) throw new Error("unknown member"); return options.member; }) },
  } as unknown as Guild;
}

function deps(overrides: Partial<ChannelResolverDeps> = {}): ChannelResolverDeps {
  return {
    findCreatorChannel: overrides.findCreatorChannel ?? (() => undefined),
    createCreatorChannel: overrides.createCreatorChannel ?? (async () => textChannel("created")),
  } as ChannelResolverDeps;
}

describe("resolveCreatorChannel", () => {
  it("uses the mapped private channel first and does not scan or create", async () => {
    const find = vi.fn(() => undefined);
    const create = vi.fn(async () => textChannel("created"));
    const channel = await resolveCreatorChannel(
      fakeGuild({ fetchChannel: textChannel("mapped") }),
      { discordUserId: "42", privateChannelId: "mapped" },
      deps({ findCreatorChannel: find as never, createCreatorChannel: create as never }),
    );
    expect(channel?.id).toBe("mapped");
    expect(find).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("falls back to the topic marker when the mapped id is stale", async () => {
    // Channel deleted in Discord but creator_discord still points at it.
    const create = vi.fn(async () => textChannel("created"));
    const channel = await resolveCreatorChannel(
      fakeGuild({ member: {} as GuildMember }),
      { discordUserId: "42", privateChannelId: "deleted-channel" },
      deps({ findCreatorChannel: (() => textChannel("by-marker")) as never, createCreatorChannel: create as never }),
    );
    expect(channel?.id).toBe("by-marker");
    expect(create).not.toHaveBeenCalled();
  });

  it("ignores a mapped id that resolved to a thread rather than a channel", async () => {
    const channel = await resolveCreatorChannel(
      fakeGuild({ fetchChannel: textChannel("a-thread", true), member: {} as GuildMember }),
      { discordUserId: "42", privateChannelId: "a-thread" },
      deps({ findCreatorChannel: (() => textChannel("by-marker")) as never }),
    );
    expect(channel?.id).toBe("by-marker");
  });

  it("creates the channel when the creator has none, so a notification is never dropped", async () => {
    const create = vi.fn(async () => textChannel("created"));
    const channel = await resolveCreatorChannel(
      fakeGuild({ member: {} as GuildMember }),
      { discordUserId: "42", privateChannelId: null },
      deps({ createCreatorChannel: create as never }),
    );
    expect(channel?.id).toBe("created");
    expect(create).toHaveBeenCalledOnce();
  });

  it("returns null when the creator has left the guild", async () => {
    const create = vi.fn(async () => textChannel("created"));
    const channel = await resolveCreatorChannel(
      fakeGuild({}),
      { discordUserId: "42", privateChannelId: null },
      deps({ createCreatorChannel: create as never }),
    );
    expect(channel).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
