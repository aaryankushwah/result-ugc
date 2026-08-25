import { afterEach, describe, expect, it } from "vitest";
import { buildScriptAssignmentMessage, cleanTitle, scriptShareUrl } from "../src/discord/script-delivery.js";

const originalPortalUrl = process.env.RESULT_PORTAL_URL;

afterEach(() => {
  if (originalPortalUrl === undefined) delete process.env.RESULT_PORTAL_URL;
  else process.env.RESULT_PORTAL_URL = originalPortalUrl;
});

describe("scriptShareUrl", () => {
  it("builds the creator-facing capability link", () => {
    process.env.RESULT_PORTAL_URL = "https://portal.example.com";
    expect(scriptShareUrl("tok123")).toBe("https://portal.example.com/s/tok123");
  });

  it("tolerates a trailing slash on the configured portal url", () => {
    process.env.RESULT_PORTAL_URL = "https://portal.example.com/";
    expect(scriptShareUrl("tok123")).toBe("https://portal.example.com/s/tok123");
  });

  it("returns null rather than a broken link when the portal url or token is missing", () => {
    process.env.RESULT_PORTAL_URL = "https://portal.example.com";
    expect(scriptShareUrl(null)).toBeNull();
    delete process.env.RESULT_PORTAL_URL;
    expect(scriptShareUrl("tok123")).toBeNull();
  });
});

describe("buildScriptAssignmentMessage", () => {
  const base = {
    discordUserId: "42",
    scriptTitle: "Pain point hook #ugc #ecom",
    scriptHook: "Oh, my expenses for the month is about $18,000. And this is how I am going to pay for it",
    shareToken: "tok123",
    dueAt: "2026-09-01T12:00:00.000Z",
    message: "Film this before Friday.",
  };

  it("pings the creator and links the script from the embed", () => {
    process.env.RESULT_PORTAL_URL = "https://portal.example.com";
    const { content, embed } = buildScriptAssignmentMessage(base);
    expect(content).toContain("<@42>");
    const json = embed.toJSON();
    expect(json.url).toBe("https://portal.example.com/s/tok123");
    expect(JSON.stringify(json.fields)).toContain("https://portal.example.com/s/tok123");
    expect(JSON.stringify(json.fields)).toContain("Film this before Friday.");
  });

  it("never includes the transcript preview", () => {
    process.env.RESULT_PORTAL_URL = "https://portal.example.com";
    const { content, embed } = buildScriptAssignmentMessage(base);
    const rendered = content + JSON.stringify(embed.toJSON());
    // A raw hook dump reads as a wall of truncated text in Discord.
    expect(rendered).not.toContain("$18,000");
    expect(embed.toJSON().description).toBeUndefined();
  });

  it("strips hashtag spam from caption-derived titles", () => {
    process.env.RESULT_PORTAL_URL = "https://portal.example.com";
    expect(buildScriptAssignmentMessage(base).embed.toJSON().title).toBe("Pain point hook");
    expect(cleanTitle("#ugc #ecom")).toBe("#ugc #ecom");
    expect(cleanTitle("   ")).toBe("Untitled script");
  });

  it("omits the due field when there is no due date", () => {
    process.env.RESULT_PORTAL_URL = "https://portal.example.com";
    const { embed } = buildScriptAssignmentMessage({ ...base, dueAt: null, message: null });
    const json = JSON.stringify(embed.toJSON().fields);
    expect(json).not.toContain("Due");
    expect(json).not.toContain("From your manager");
  });

  it("tells the creator a link is coming instead of printing a dead url", () => {
    delete process.env.RESULT_PORTAL_URL;
    const { embed } = buildScriptAssignmentMessage({ ...base, shareToken: null });
    const json = JSON.stringify(embed.toJSON());
    expect(json).toContain("shortly");
    expect(json).not.toContain("undefined");
  });
});
