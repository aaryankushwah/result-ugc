import { ChannelType, Collection, OverwriteType, PermissionFlagsBits, type Guild, type GuildMember, type Role, type TextChannel } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { createCreatorChannel, creatorChannelOverwrites } from "../src/discord/setup.js";

function role(id: string, name: string): Role {
  return { id, name } as Role;
}

function fixture() {
  const setOverwrites = vi.fn(async () => undefined);
  const edit = vi.fn(async () => undefined);
  const send = vi.fn(async () => undefined);
  const existing = {
    id: "channel",
    type: ChannelType.GuildText,
    topic: "Private workspace. Creator ID: 123456789012345678.",
    permissionOverwrites: { set: setOverwrites },
    edit,
    messages: { fetch: vi.fn(async () => new Collection()) },
    send,
    client: { user: { id: "bot" } },
  } as unknown as TextChannel;
  const channels = new Collection<string, TextChannel>();
  channels.set(existing.id, existing);
  const roles = new Collection<string, Role>();
  roles.set("manager", role("manager", "UGC Manager"));
  roles.set("admin", role("admin", "Admin"));
  const guild = {
    ownerId: "owner",
    channels: { cache: channels, fetch: vi.fn(async () => channels) },
    roles: { cache: roles, everyone: { id: "everyone" }, fetch: vi.fn(async () => roles) },
    members: { me: { id: "bot" } },
  } as unknown as Guild;
  const member = { id: "123456789012345678", user: { tag: "seb0006_" } } as GuildMember;
  return { guild, member, setOverwrites, edit, send };
}

describe("creator channel access", () => {
  it("grants the creator explicit access", () => {
    const { guild, member } = fixture();
    const overwrites = creatorChannelOverwrites(guild, member) as Array<{ id: string; type: OverwriteType; allow?: bigint[]; deny?: bigint[] }>;
    expect(overwrites.find((entry) => entry.id === member.id)).toMatchObject({ type: OverwriteType.Member });
    expect(overwrites.find((entry) => entry.id === member.id)?.allow).toContain(PermissionFlagsBits.ViewChannel);
    expect(overwrites.find((entry) => entry.id === "everyone")?.deny).toContain(PermissionFlagsBits.ViewChannel);
  });

  it("repairs permissions when approval reuses an existing creator channel", async () => {
    const { guild, member, setOverwrites, edit, send } = fixture();
    await createCreatorChannel(guild, member);
    expect(setOverwrites).toHaveBeenCalledOnce();
    expect(setOverwrites.mock.calls[0]?.[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: member.id, type: OverwriteType.Member }),
    ]));
    expect(edit).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
  });
});
