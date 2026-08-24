import { activityEvents, scriptReferences } from "@result/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { managerContext, mutationErrorResponse, MutationError } from "@/lib/mutation-context";
import { invalidatePortalData } from "@/lib/portal-cache";
import { parseReferenceUrl, ReferenceResolutionError, resolveInstagramReel } from "@/lib/reference-ingest";
import { transcribeVideo, TranscriptionError } from "@/lib/transcription";

// Scrape (~3s) + download (~3s) + Whisper (~10-20s) for a sub-90s reel.
export const maxDuration = 60;

const ingestSchema = z.object({ url: z.string().trim().min(1).max(2_000) });

export async function POST(request: Request) {
  try {
    const parsed = ingestSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Paste a reel link to get started." }, { status: 400 });

    const reference = parseReferenceUrl(parsed.data.url);
    if (reference.kind === "coming_soon") {
      return Response.json({ error: "TikTok support is coming soon. Paste an Instagram reel link, or add the transcript manually." }, { status: 422 });
    }
    if (reference.kind === "unsupported") {
      return Response.json({ error: reference.reason }, { status: 400 });
    }

    const context = await managerContext();

    // Claim the row first so a failure is recoverable and visible rather than lost.
    const [row] = await context.db.insert(scriptReferences).values({
      organizationId: context.organization.id,
      sourcePlatform: "instagram",
      sourceUrl: reference.canonicalUrl,
      transcriptState: "pending",
      transcript: "",
      transcriptSections: [],
      sourceMetadata: {},
      createdByUserId: context.internalUser?.id ?? null,
    }).returning({ id: scriptReferences.id });
    if (!row) throw new MutationError(500, "Could not start the reel import");

    const scopedTo = and(eq(scriptReferences.id, row.id), eq(scriptReferences.organizationId, context.organization.id));

    try {
      const resolved = await resolveInstagramReel(reference.shortcode);
      await context.db.update(scriptReferences).set({
        transcriptState: "transcribing",
        sourceCreator: resolved.author,
        sourceMetadata: {
          author: resolved.author,
          caption: resolved.caption,
          durationSeconds: resolved.durationSeconds,
          thumbnailUrl: resolved.thumbnailUrl,
          raw: resolved.raw,
        },
        updatedAt: new Date(),
      }).where(scopedTo);

      const { transcript, sections } = await transcribeVideo(resolved.videoUrl);

      await context.db.update(scriptReferences).set({
        transcriptState: "transcribed",
        transcript,
        transcriptSections: sections,
        updatedAt: new Date(),
      }).where(scopedTo);

      await context.db.insert(activityEvents).values({
        organizationId: context.organization.id,
        actorUserId: context.internalUser?.id ?? null,
        type: "reference.ingested",
        summary: `Reel from ${resolved.author ? `@${resolved.author}` : "Instagram"} was imported and transcribed.`,
        metadata: { referenceId: row.id, sourceUrl: reference.canonicalUrl, sections: sections.length },
      });
      invalidatePortalData();

      return Response.json({
        ok: true,
        reference: {
          id: row.id,
          sourcePlatform: "instagram",
          sourceUrl: reference.canonicalUrl,
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
        : error instanceof Error ? error.message : "The reel could not be imported.";
      await context.db.update(scriptReferences).set({
        transcriptState: "failed",
        sourceMetadata: { error: message },
        updatedAt: new Date(),
      }).where(scopedTo);
      await context.db.insert(activityEvents).values({
        organizationId: context.organization.id,
        actorUserId: context.internalUser?.id ?? null,
        type: "reference.ingest_failed",
        summary: `Reel import failed: ${message}`,
        metadata: { referenceId: row.id, sourceUrl: reference.canonicalUrl },
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
  if (firstLine) return firstLine.slice(0, 120);
  return author ? `Reel from @${author}` : "Imported reel";
}
