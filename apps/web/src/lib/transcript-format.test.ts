import { describe, expect, it } from "vitest";
import { formatTimecode, formatTimecodeRange, segmentsToTranscriptSections, transcriptTextFromSections } from "./transcript-format";

describe("transcript formatting", () => {
  it("formats real timecodes from Whisper offsets", () => {
    expect(formatTimecode(0)).toBe("0:00");
    expect(formatTimecode(7.8)).toBe("0:07");
    expect(formatTimecode(65)).toBe("1:05");
    expect(formatTimecodeRange(0, 3.4)).toBe("0:00–0:03");
  });

  it("maps segments onto transcript sections in order", () => {
    const sections = segmentsToTranscriptSections([
      { startSecond: 0, endSecond: 2.5, text: " Stop scrolling. " },
      { startSecond: 2.5, endSecond: 6, text: "This changed everything." },
    ]);
    expect(sections).toEqual([
      { id: "transcript-1", label: "Segment 1", timecode: "0:00–0:02", text: "Stop scrolling." },
      { id: "transcript-2", label: "Segment 2", timecode: "0:02–0:06", text: "This changed everything." },
    ]);
  });

  it("drops blank segments and renumbers so ids stay contiguous", () => {
    const sections = segmentsToTranscriptSections([
      { startSecond: 0, endSecond: 1, text: "One." },
      { startSecond: 1, endSecond: 2, text: "   " },
      { startSecond: 2, endSecond: 3, text: "Two." },
    ]);
    expect(sections.map((section) => section.id)).toEqual(["transcript-1", "transcript-2"]);
    expect(sections.map((section) => section.text)).toEqual(["One.", "Two."]);
  });

  it("handles an empty transcription without throwing", () => {
    expect(segmentsToTranscriptSections([])).toEqual([]);
    expect(transcriptTextFromSections([])).toBe("");
  });

  it("rebuilds a single clean transcript string", () => {
    const sections = segmentsToTranscriptSections([
      { startSecond: 0, endSecond: 1, text: "Stop scrolling." },
      { startSecond: 1, endSecond: 2, text: "Here is why." },
    ]);
    expect(transcriptTextFromSections(sections)).toBe("Stop scrolling. Here is why.");
  });
});
