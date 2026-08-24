import { activityEvents, scriptAssets, scriptReferences, scripts, scriptVersions } from "@result/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { managerContext, mutationErrorResponse } from "@/lib/mutation-context";
import { estimateScriptDuration, scriptHookFromSections } from "@/lib/script-writing";
import { invalidatePortalData } from "@/lib/portal-cache";

const sectionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  timecode: z.string().trim().max(40),
  delivery: z.string().trim().max(200),
  copy: z.string().trim().min(1).max(10_000),
  visualDirection: z.string().trim().max(2_000),
  assetIds: z.array(z.string()).max(40).default([]),
});

const transcriptSectionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  timecode: z.string().trim().max(40),
  text: z.string().trim().min(1).max(10_000),
});

const assetSchema = z.object({
  label: z.string().trim().min(1).max(160),
  kind: z.enum(["reference_video", "image", "audio", "file"]),
  sourceUrl: z.url().max(2_000),
});

const createScriptSchema = z.object({
  title: z.string().trim().min(1).max(240),
  pipelineStage: z.enum(["not_started", "testing", "iterate", "winner", "retired"]).default("not_started"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  category: z.string().trim().min(1).max(100).default("Uncategorized"),
  format: z.string().trim().min(1).max(100).default("Talking head"),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  targetPlatform: z.string().trim().min(1).max(40).default("instagram"),
  sections: z.array(sectionSchema).min(1).max(24),
  assets: z.array(assetSchema).max(40).default([]),
  brandSnapshot: z.record(z.string(), z.unknown()).default({}),
  referenceId: z.uuid().nullable().optional(),
  reference: z.object({
    sourcePlatform: z.string().trim().min(1).max(40).default("instagram"),
    sourceUrl: z.url().max(2_000).nullable().optional(),
    sourceCreator: z.string().trim().max(160).nullable().optional(),
    transcript: z.string().trim().min(1).max(100_000),
    transcriptSections: z.array(transcriptSectionSchema).max(30),
  }).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = createScriptSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Add a title and at least one complete script section.", details: parsed.error.flatten() }, { status: 400 });
    const context = await managerContext();
    const result = await context.db.transaction(async (transaction) => {
      let referenceId: string | null = null;
      if (parsed.data.referenceId) {
        // Already created by /api/references/ingest — reuse it rather than duplicating the transcript.
        const existing = (await transaction.select({ id: scriptReferences.id }).from(scriptReferences)
          .where(and(eq(scriptReferences.id, parsed.data.referenceId), eq(scriptReferences.organizationId, context.organization.id))).limit(1))[0];
        referenceId = existing?.id ?? null;
      }
      if (!referenceId && parsed.data.reference) {
        const [reference] = await transaction.insert(scriptReferences).values({
          organizationId: context.organization.id,
          sourcePlatform: parsed.data.reference.sourcePlatform,
          sourceUrl: parsed.data.reference.sourceUrl ?? null,
          sourceCreator: parsed.data.reference.sourceCreator ?? null,
          transcriptState: "provided",
          transcript: parsed.data.reference.transcript,
          transcriptSections: parsed.data.reference.transcriptSections,
          createdByUserId: context.internalUser?.id ?? null,
        }).returning({ id: scriptReferences.id });
        referenceId = reference?.id ?? null;
      }
      const durationSeconds = estimateScriptDuration(parsed.data.sections);
      const [script] = await transaction.insert(scripts).values({
        organizationId: context.organization.id,
        referenceId,
        title: parsed.data.title,
        pipelineStage: parsed.data.pipelineStage,
        priority: parsed.data.priority,
        category: parsed.data.category,
        format: parsed.data.format,
        tags: parsed.data.tags,
        targetPlatform: parsed.data.targetPlatform,
        durationSeconds,
        hook: scriptHookFromSections(parsed.data.sections),
        sections: parsed.data.sections,
        brandSnapshot: parsed.data.brandSnapshot,
        createdByUserId: context.internalUser?.id ?? null,
        updatedByUserId: context.internalUser?.id ?? null,
      }).returning({ id: scripts.id });
      if (!script) throw new Error("Script was not created");
      const createdAssets = parsed.data.assets.length ? await transaction.insert(scriptAssets).values(parsed.data.assets.map((asset) => ({
        organizationId: context.organization.id,
        scriptId: script.id,
        label: asset.label,
        kind: asset.kind,
        sourceUrl: asset.sourceUrl,
        createdByUserId: context.internalUser?.id ?? null,
      }))).returning({ id: scriptAssets.id, label: scriptAssets.label, kind: scriptAssets.kind, sourceUrl: scriptAssets.sourceUrl, downloadUrl: scriptAssets.downloadUrl }) : [];
      await transaction.insert(scriptVersions).values({
        organizationId: context.organization.id,
        scriptId: script.id,
        version: 1,
        title: parsed.data.title,
        sections: parsed.data.sections,
        changeSummary: "Initial script created",
        createdByUserId: context.internalUser?.id ?? null,
      });
      await transaction.insert(activityEvents).values({
        organizationId: context.organization.id,
        actorUserId: context.internalUser?.id ?? null,
        type: "script.created",
        summary: `Script “${parsed.data.title}” was created.`,
        metadata: { scriptId: script.id, referenceId, targetPlatform: parsed.data.targetPlatform, assetCount:createdAssets.length },
      });
      return { id: script.id, referenceId, durationSeconds, assets: createdAssets };
    });
    invalidatePortalData();
    return Response.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
