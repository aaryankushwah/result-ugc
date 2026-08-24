import { afterEach, describe, expect, it } from "vitest";
import { buildScriptAssignmentMessage, scriptShareUrl } from "../src/discord/script-delivery.js";

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
  it("pings the creator and links the script", () => {
    process.env.RESULT_PORTAL_URL = "https://portal.example.com";
    const { content, embed } = buildScriptAssignmentMessage({
      discordUserId: "42",
      scriptTitle: "Pain point hook",
      scriptHook: "Stop scrolling.",
      shareToken: "tok123",
      dueAt: "2026-09-01T12:00:00.000Z",
      message: "Film this before Friday.",
    });
    expect(content).toContain("<@42>");
    expect(content).toContain("https://portal.example.com/s/tok123");
    const json = embed.toJSON();
    expect(json.title).toBe("Pain point hook");
    expect(json.description).toContain("Stop scrolling.");
    expect(json.description).toContain("Film this before Friday.");
    expect(json.url).toBe("https://portal.example.com/s/tok123");
  });

  it("still produces a usable message with no due date, hook or note", () => {
    process.env.RESULT_PORTAL_URL = "https://portal.example.com";
    const { content, embed } = buildScriptAssignmentMessage({
      discordUserId: "42",
      scriptTitle: "Untitled script",
      scriptHook: null,
      shareToken: "tok123",
      dueAt: null,
      message: null,
    });
    expect(content).toContain("<@42>");
    expect(content).not.toContain("Due");
    expect(embed.toJSON().description).toBeUndefined();
  });

  it("tells the creator a link is coming instead of printing a dead url", () => {
    delete process.env.RESULT_PORTAL_URL;
    const { content } = buildScriptAssignmentMessage({
      discordUserId: "42",
      scriptTitle: "Untitled script",
      scriptHook: null,
      shareToken: null,
      dueAt: null,
      message: null,
    });
    expect(content).toContain("shortly");
    expect(content).not.toContain("undefined");
  });
});
