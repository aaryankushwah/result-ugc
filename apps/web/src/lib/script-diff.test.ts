import { describe, expect, it } from "vitest";
import { diffWords, preservedRatio } from "./script-diff";

const changed = (before: string, after: string) => diffWords(before, after).filter((token) => token.state !== "same");

describe("diffWords", () => {
  it("reports no changes when the script is untouched", () => {
    const tokens = diffWords("Stop scrolling. This changed everything.", "Stop scrolling. This changed everything.");
    expect(tokens.every((token) => token.state === "same")).toBe(true);
    expect(preservedRatio(tokens)).toBe(1);
  });

  it("marks only the swapped business term", () => {
    const tokens = changed(
      "I switched to Acme and my whole week opened up.",
      "I switched to Result and my whole week opened up.",
    );
    expect(tokens).toEqual([
      { text: "Acme", state: "removed" },
      { text: "Result", state: "added" },
    ]);
  });

  it("ignores case and trailing punctuation when matching, so wording is not falsely flagged", () => {
    const tokens = diffWords("stop scrolling", "Stop scrolling.");
    expect(tokens.every((token) => token.state === "same")).toBe(true);
  });

  it("flags added marketing sentences, which is the failure mode we care about", () => {
    const tokens = changed(
      "I switched and my week opened up.",
      "I switched and my week opened up. Revolutionise your workflow today.",
    );
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.every((token) => token.state === "added")).toBe(true);
  });

  it("scores preservation against the source, not the output", () => {
    // Four source words, one replaced.
    const tokens = diffWords("one two three four", "one two three five");
    expect(preservedRatio(tokens)).toBeCloseTo(0.75, 5);
  });

  it("handles empty input", () => {
    expect(diffWords("", "")).toEqual([]);
    expect(preservedRatio([])).toBe(1);
  });
});
