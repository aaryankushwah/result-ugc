import { describe, expect, it } from "vitest";
import { adaptReferenceForResult, estimateScriptDuration, formatScriptForClipboard, segmentTranscript } from "./script-writing";

describe("script writing helpers", () => {
  it("segments a pasted transcript into timed creative beats", () => {
    expect(segmentTranscript("Stop losing hooks. Your briefs are scattered. Put them in one workflow.")).toEqual([
      { id: "transcript-1", label: "HOOK", timecode: "0:00", text: "Stop losing hooks." },
      { id: "transcript-2", label: "PROBLEM", timecode: "0:04", text: "Your briefs are scattered." },
      { id: "transcript-3", label: "SOLUTION", timecode: "0:08", text: "Put them in one workflow." },
    ]);
  });

  it("adapts the reference without claiming to transcribe a URL", () => {
    const sections = adaptReferenceForResult("Your team is slow. Briefs live in five places.");
    expect(sections[0]?.copy).toBe("Your UGC team is slow.");
    expect(sections[2]?.copy).toContain("With Result");
    expect(sections).toHaveLength(4);
  });

  it("produces a creator-ready clipboard format and duration", () => {
    const sections = adaptReferenceForResult("This is the hook. This is the problem.");
    expect(estimateScriptDuration(sections)).toBeGreaterThan(10);
    expect(formatScriptForClipboard("Test script", sections)).toContain("VISUAL:");
  });
});
