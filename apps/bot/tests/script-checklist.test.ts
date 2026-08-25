import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildScriptChecklist, escapeMarkdown, stateLabel } from "../src/discord/script-checklist.js";
import { creatorIdFromChannelTopic } from "../src/discord/setup.js";

const original = process.env.RESULT_PORTAL_URL;
beforeEach(() => { process.env.RESULT_PORTAL_URL = "https://portal.example.com"; });
afterEach(() => { if (original === undefined) delete process.env.RESULT_PORTAL_URL; else process.env.RESULT_PORTAL_URL = original; });

const entry = (over: Partial<Parameters<typeof buildScriptChecklist>[0][number]> = {}) => ({
  title: "Pain point hook",
  state: "assigned",
  dueAt: null,
  shareToken: "tok1",
  ...over,
});

describe("buildScriptChecklist", () => {
  it("renders an unticked box per outstanding script and a tick for approved", () => {
    const out = buildScriptChecklist([entry(), entry({ title: "Winner", state: "approved", shareToken: "tok2" })], { forName: "you" });
    expect(out).toContain("⬜ **[Pain point hook](https://portal.example.com/s/tok1)**");
    expect(out).toContain("✅ **[Winner](https://portal.example.com/s/tok2)**");
  });

  it("counts only outstanding scripts as work to film", () => {
    const out = buildScriptChecklist(
      [entry(), entry({ state: "approved" }), entry({ state: "filming" })],
      { forName: "Eddie" },
    );
    expect(out).toContain("**Scripts for Eddie** · 2 to film · 3 total");
  });

  it("uses plain-language state labels rather than raw enum values", () => {
    expect(stateLabel("changes_requested")).toBe("Changes requested");
    expect(stateLabel("submitted")).toBe("Waiting on review");
    expect(stateLabel("some_new_state")).toBe("some new state");
  });

  it("renders a Discord timestamp for due dates and nothing when absent", () => {
    const due = buildScriptChecklist([entry({ dueAt: "2026-09-01T12:00:00.000Z" })], { forName: "you" });
    expect(due).toMatch(/due <t:\d+:D>/);
    expect(buildScriptChecklist([entry()], { forName: "you" })).not.toContain("due <t:");
  });

  it("stays compact - two lines per script, no transcript preview", () => {
    const out = buildScriptChecklist([entry(), entry({ title: "Second", shareToken: "tok2" })], { forName: "you" });
    // header + blank + 2 lines per entry
    expect(out.split("\n")).toHaveLength(6);
    expect(out).not.toMatch(/\.{3}|…/);
  });

  it("says so plainly when there is nothing assigned", () => {
    expect(buildScriptChecklist([], { forName: "Eddie" })).toBe("**Eddie** has no scripts assigned right now.");
  });

  it("flags truncation so a long list is not silently cut", () => {
    expect(buildScriptChecklist([entry()], { forName: "you", truncated: true })).toContain("10 most recent");
  });

  it("falls back to plain text when no share link is available", () => {
    delete process.env.RESULT_PORTAL_URL;
    const out = buildScriptChecklist([entry()], { forName: "you" });
    expect(out).toContain("**Pain point hook**");
    expect(out).not.toContain("](");
  });

  it("escapes markdown in caption-derived titles so links do not break", () => {
    expect(escapeMarkdown("buy [now] (cheap)")).toBe("buy \\[now\\] \\(cheap\\)");
    expect(buildScriptChecklist([entry({ title: "a [b] c" })], { forName: "you" })).toContain("a \\[b\\] c");
  });
});

describe("creatorIdFromChannelTopic", () => {
  it("reads the owner id from a creator channel topic", () => {
    expect(creatorIdFromChannelTopic("Private workspace for eddie. Creator ID: 846407998104010753.")).toBe("846407998104010753");
  });

  it("returns null for non-creator channels", () => {
    expect(creatorIdFromChannelTopic("General chat")).toBeNull();
    expect(creatorIdFromChannelTopic(null)).toBeNull();
    expect(creatorIdFromChannelTopic(undefined)).toBeNull();
    expect(creatorIdFromChannelTopic("Creator ID: notanid")).toBeNull();
  });
});
