import { activityEvents, scripts, scriptVersions } from "@result/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { managerContext, mutationErrorResponse, MutationError } from "@/lib/mutation-context";
import { estimateScriptDuration, scriptHookFromSections } from "@/lib/script-writing";
import { invalidatePortalData } from "@/lib/portal-cache";

const sectionSchema = z.object({ id:z.string().min(1).max(80), label:z.string().min(1).max(80), timecode:z.string().max(40), delivery:z.string().max(200), copy:z.string().min(1).max(10_000), visualDirection:z.string().max(2_000), assetIds:z.array(z.string()).max(40) });
const updateScriptSchema = z.object({
  title: z.string().trim().min(1).max(240),
  status: z.enum(["draft", "ready", "assigned", "in_review", "approved", "published", "archived"]).optional(),
  pipelineStage: z.enum(["not_started", "testing", "iterate", "winner", "retired"]),
  priority: z.enum(["low", "medium", "high"]),
  category: z.string().trim().min(1).max(100),
  format: z.string().trim().min(1).max(100),
  tags: z.array(z.string().trim().min(1).max(60)).max(20),
  targetPlatform: z.string().trim().min(1).max(40),
  sections: z.array(sectionSchema).min(1).max(24),
  changeSummary: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = updateScriptSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "The script update is incomplete.", details: parsed.error.flatten() }, { status: 400 });
    const context = await managerContext();
    const current = (await context.db.select().from(scripts).where(and(eq(scripts.id, id), eq(scripts.organizationId, context.organization.id))).limit(1))[0];
    if (!current) throw new MutationError(404, "Script not found");
    const nextVersion = current.latestVersion + 1;
    await context.db.transaction(async (transaction) => {
      await transaction.update(scripts).set({
        title: parsed.data.title,
        status: parsed.data.status ?? current.status,
        pipelineStage: parsed.data.pipelineStage,
        priority: parsed.data.priority,
        category: parsed.data.category,
        format: parsed.data.format,
        tags: parsed.data.tags,
        targetPlatform: parsed.data.targetPlatform,
        durationSeconds: estimateScriptDuration(parsed.data.sections),
        hook: scriptHookFromSections(parsed.data.sections),
        sections: parsed.data.sections,
        latestVersion: nextVersion,
        updatedByUserId: context.internalUser?.id ?? null,
        updatedAt: new Date(),
      }).where(and(eq(scripts.id, id), eq(scripts.organizationId, context.organization.id)));
      await transaction.insert(scriptVersions).values({
        organizationId: context.organization.id,
        scriptId: id,
        version: nextVersion,
        title: parsed.data.title,
        sections: parsed.data.sections,
        changeSummary: parsed.data.changeSummary ?? "Script updated",
        createdByUserId: context.internalUser?.id ?? null,
      });
      await transaction.insert(activityEvents).values({
        organizationId: context.organization.id,
        actorUserId: context.internalUser?.id ?? null,
        type: "script.updated",
        summary: `Script “${parsed.data.title}” was updated to version ${nextVersion}.`,
        metadata: { scriptId: id, version: nextVersion },
      });
    });
    invalidatePortalData();
    return Response.json({ ok: true, version: nextVersion });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
