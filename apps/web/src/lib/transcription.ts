import "server-only";

import type { TranscriptSection } from "@result/db";
import { transcribe } from "ai";
import { hasGatewayCredentials } from "./ai-gateway";
import { segmentsToTranscriptSections, transcriptTextFromSections, type TranscriptSegment } from "./transcript-format";

export class TranscriptionError extends Error {}

/** Whisper rejects uploads above 25MB. Reels are far smaller, but guard it clearly. */
const MAX_BYTES = 25 * 1024 * 1024;

/** Routed through the Vercel AI Gateway — no provider key of our own. */
export const TRANSCRIPTION_MODEL = "openai/whisper-1";

export type Transcription = { transcript: string; sections: TranscriptSection[]; durationSeconds: number | null };

/**
 * Downloads the reel and transcribes it. Whisper accepts mp4 directly, so no
 * ffmpeg or audio extraction step is needed.
 */
export async function transcribeVideo(videoUrl: string, signal?: AbortSignal): Promise<Transcription> {
  if (!hasGatewayCredentials()) {
    throw new TranscriptionError("AI Gateway is not configured, so reels cannot be transcribed. Paste the transcript manually instead.");
  }

  const media = await fetch(videoUrl, signal ? { signal } : {});
  if (!media.ok) throw new TranscriptionError(`The reel media could not be downloaded (${media.status}).`);

  const bytes = new Uint8Array(await media.arrayBuffer());
  if (bytes.byteLength === 0) throw new TranscriptionError("The reel media was empty.");
  if (bytes.byteLength > MAX_BYTES) {
    throw new TranscriptionError("That reel is larger than the 25MB transcription limit. Paste the transcript manually instead.");
  }

  let result;
  try {
    result = await transcribe({ model: TRANSCRIPTION_MODEL, audio: bytes, ...(signal ? { abortSignal: signal } : {}) });
  } catch (error) {
    throw new TranscriptionError(error instanceof Error ? `Transcription failed: ${error.message}` : "Transcription failed.");
  }

  const segments: TranscriptSegment[] = (result.segments ?? []).flatMap((segment) => {
    const startSecond = typeof segment.startSecond === "number" ? segment.startSecond : null;
    const endSecond = typeof segment.endSecond === "number" ? segment.endSecond : null;
    return startSecond === null || endSecond === null ? [] : [{ startSecond, endSecond, text: segment.text }];
  });

  const sections = segmentsToTranscriptSections(segments);
  const transcript = sections.length ? transcriptTextFromSections(sections) : result.text.trim();
  if (!transcript) throw new TranscriptionError("No speech was detected in that reel.");

  return { transcript, sections, durationSeconds: result.durationInSeconds ?? null };
}
