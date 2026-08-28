import { describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";
import { showWarmupDetails } from "../src/discord/interactions.js";

describe("warmup details interaction", () => {
  it("publishes the staff roster to the channel instead of replying ephemerally", async () => {
    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      guild: { id: "guild-1" },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await showWarmupDetails(interaction, async () => []);

    expect(deferReply).toHaveBeenCalledOnce();
    expect(deferReply).toHaveBeenCalledWith();
    expect(editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.any(Array),
      allowedMentions: { parse: [] },
    }));
  });
});
