import "server-only";

import type { TranscriptSection } from "@result/db";
import { segmentsToTranscriptSections, transcriptTextFromSections, type WhisperSegment } from "./transcript-format";

export class TranscriptionError extends Error {}

/** OpenAI rejects uploads above 25MB. Reels are far smaller, but guard it clearly. */
const MAX_BYTES = 25 * 1024 * 1024;

export type Transcription = { transcript: string; sections: TranscriptSection[] };

/**
 * Downloads the reel and transcribes it. Whisper accepts mp4 directly, so no
 * ffmpeg or audio extraction step is needed.
 */
export async function transcribeVideo(videoUrl: string, signal?: AbortSignal): Promise<Transcription> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new TranscriptionError("OPENAI_API_KEY is not configured, so reels cannot be transcribed. Paste the transcript manually instead.");

  const media = await fetch(videoUrl, signal ? { signal } : {});
  if (!media.ok) throw new TranscriptionError(`The reel media could not be downloaded (${media.status}).`);

  const bytes = await media.arrayBuffer();
  if (bytes.byteLength === 0) throw new TranscriptionError("The reel media was empty.");
  if (bytes.byteLength > MAX_BYTES) {
    throw new TranscriptionError("That reel is larger than the 25MB transcription limit. Paste the transcript manually instead.");
  }

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: media.headers.get("content-type") ?? "video/mp4" }), "reference.mp4");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new TranscriptionError(`Transcription failed (${response.status}). ${detail.slice(0, 200)}`.trim());
  }

  const payload = (await response.json()) as { text?: unknown; segments?: unknown };
  const segments: WhisperSegment[] = Array.isArray(payload.segments)
    ? payload.segments.flatMap((segment) => {
        const record = segment as Record<string, unknown>;
        const start = typeof record.start === "number" ? record.start : null;
        const end = typeof record.end === "number" ? record.end : null;
        const text = typeof record.text === "string" ? record.text : null;
        return start === null || end === null || text === null ? [] : [{ start, end, text }];
      })
    : [];

  const sections = segmentsToTranscriptSections(segments);
  const transcript = sections.length
    ? transcriptTextFromSections(sections)
    : typeof payload.text === "string"
      ? payload.text.trim()
      : "";

  if (!transcript) throw new TranscriptionError("No speech was detected in that reel.");
  return { transcript, sections };
}
