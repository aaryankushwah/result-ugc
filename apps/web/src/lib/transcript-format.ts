import type { TranscriptSection } from "@result/db";

/** Shape returned by the AI SDK's `transcribe` (note: startSecond/endSecond, not start/end). */
export type TranscriptSegment = { startSecond: number; endSecond: number; text: string };

export function formatTimecode(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

export function formatTimecodeRange(start: number, end: number): string {
  return `${formatTimecode(start)}–${formatTimecode(end)}`;
}

/**
 * Maps transcription segments onto the TranscriptSection shape the studio stores.
 * Timecodes are real, unlike the synthetic 4-seconds-per-sentence counter used
 * when a transcript is pasted by hand.
 */
export function segmentsToTranscriptSections(segments: TranscriptSegment[]): TranscriptSection[] {
  return segments
    .map((segment) => ({ ...segment, text: segment.text.trim() }))
    .filter((segment) => segment.text.length > 0)
    .map((segment, index) => ({
      id: `transcript-${index + 1}`,
      label: `Segment ${index + 1}`,
      timecode: formatTimecodeRange(segment.startSecond, segment.endSecond),
      text: segment.text,
    }));
}

export function transcriptTextFromSections(sections: TranscriptSection[]): string {
  return sections.map((section) => section.text).join(" ").replace(/\s+/g, " ").trim();
}
