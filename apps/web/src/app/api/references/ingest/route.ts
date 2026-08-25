import { activityEvents, scriptReferences } from "@result/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { managerContext, mutationErrorResponse, MutationError } from "@/lib/mutation-context";
import { invalidatePortalData } from "@/lib/portal-cache";
import { parseReferenceUrl, ReferenceResolutionError, resolvePastedUrl } from "@/lib/reference-ingest";
import { cleanScriptTitle } from "@/lib/script-title";
import { transcribeVideo, TranscriptionError } from "@/lib/transcription";

// Short-link expansion (free) + live lookup (~3s) + Whisper (~10-20s) for a short video.
export const maxDuration = 60;

const ingestSchema = z.object({ url: z.string().trim().min(1).max(2_000) });

export async function POST(request: Request) {
  try {
    const parsed = ingestSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Paste a reel or TikTok link to get started." }, { status: 400 });

    // Reject junk before writing a row or spending credits.
    const preflight = parseReferenceUrl(parsed.data.url);
    if (preflight.kind === "unsupported") return Response.json({ error: preflight.reason }, { status: 400 });

    const context = await managerContext();
    const platform = preflight.platform;

    // Claim the row first so a failure is recoverable and visible rather than lost.
    const [row] = await context.db.insert(scriptReferences).values({
      organizationId: context.organization.id,
      sourcePlatform: platform,
      sourceUrl: preflight.kind === "video" ? preflight.canonicalUrl : preflight.url,
      transcriptState: "pending",
      transcript: "",
      transcriptSections: [],
      sourceMetadata: {},
      createdByUserId: context.internalUser?.id ?? null,
    }).returning({ id: scriptReferences.id });
    if (!row) throw new MutationError(500, "Could not start the import");

    const scopedTo = and(eq(scriptReferences.id, row.id), eq(scriptReferences.organizationId, context.organization.id));

    try {
      const resolved = await resolvePastedUrl(parsed.data.url);
      await context.db.update(scriptReferences).set({
        transcriptState: "transcribing",
        sourcePlatform: resolved.platform,
        sourceUrl: resolved.canonicalUrl,
        sourceCreator: resolved.author,
        updatedAt: new Date(),
      }).where(scopedTo);

      const { transcript, sections, durationSeconds } = await transcribeVideo(resolved.videoUrl);

      await context.db.update(scriptReferences).set({
        transcriptState: "transcribed",
        transcript,
        transcriptSections: sections,
        sourceMetadata: {
          author: resolved.author,
          caption: resolved.caption,
          durationSeconds: durationSeconds ?? resolved.durationSeconds,
          thumbnailUrl: resolved.thumbnailUrl,
          raw: resolved.raw,
        },
        updatedAt: new Date(),
      }).where(scopedTo);

      await context.db.insert(activityEvents).values({
        organizationId: context.organization.id,
        actorUserId: context.internalUser?.id ?? null,
        type: "reference.ingested",
        summary: `${resolved.platform === "instagram" ? "Reel" : "TikTok"} from ${resolved.author ? `@${resolved.author}` : resolved.platform} was imported and transcribed.`,
        metadata: { referenceId: row.id, platform: resolved.platform, sourceUrl: resolved.canonicalUrl, sections: sections.length },
      });
      invalidatePortalData();

      return Response.json({
        ok: true,
        reference: {
          id: row.id,
          sourcePlatform: resolved.platform,
          sourceUrl: resolved.canonicalUrl,
          sourceCreator: resolved.author,
          transcriptState: "transcribed",
          transcript,
          transcriptSections: sections,
        },
        suggestedTitle: suggestTitle(resolved.caption, resolved.author),
      });
    } catch (error) {
      const message = error instanceof ReferenceResolutionError || error instanceof TranscriptionError
        ? error.message
        : error instanceof Error ? error.message : "The link could not be imported.";
      await context.db.update(scriptReferences).set({
        transcriptState: "failed",
        sourceMetadata: { error: message },
        updatedAt: new Date(),
      }).where(scopedTo);
      await context.db.insert(activityEvents).values({
        organizationId: context.organization.id,
        actorUserId: context.internalUser?.id ?? null,
        type: "reference.ingest_failed",
        summary: `Import failed: ${message}`,
        metadata: { referenceId: row.id, platform, url: parsed.data.url },
      });
      invalidatePortalData();
      return Response.json({ error: message, referenceId: row.id }, { status: 502 });
    }
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

function suggestTitle(caption: string | null, author: string | null): string {
  const firstLine = caption?.split(/\n+/).map((line) => line.trim()).find(Boolean);
  // Captions are usually mostly hashtags; keep the idea, drop the spam.
  const cleaned = firstLine ? cleanScriptTitle(firstLine) : "";
  if (cleaned) return cleaned.slice(0, 120);
  return author ? `Video from @${author}` : "Imported video";
}
