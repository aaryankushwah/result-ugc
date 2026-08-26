import { activityEvents, discordOperations, scriptAssignments, scriptAssets, scripts, scriptVersions } from "@result/db";
import { del } from "@vercel/blob";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { managerContext, mutationErrorResponse, MutationError } from "@/lib/mutation-context";
import { estimateScriptDuration, scriptHookFromSections } from "@/lib/script-writing";
import { invalidatePortalData } from "@/lib/portal-cache";

const sectionSchema = z.object({ id:z.string().min(1).max(80), label:z.string().max(80), timecode:z.string().max(40), delivery:z.string().max(200), copy:z.string().max(10_000), visualDirection:z.string().max(2_000), assetIds:z.array(z.string()).max(40), blockType:z.enum(["text","heading_1","heading_2","heading_3","beat","direction","dialogue","bullet","quote","divider"]).optional() });
const updateScriptSchema = z.object({
  title: z.string().trim().min(1).max(240),
  status: z.enum(["draft", "ready", "assigned", "in_review", "approved", "published", "archived"]).optional(),
  pipelineStage: z.enum(["not_started", "testing", "iterate", "winner", "retired"]),
  priority: z.enum(["low", "medium", "high"]),
  category: z.string().trim().min(1).max(100),
  format: z.string().trim().min(1).max(100),
  tags: z.array(z.string().trim().min(1).max(60)).max(20),
  targetPlatform: z.string().trim().min(1).max(40),
  sections: z.array(sectionSchema).min(1).max(120),
  changeSummary: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = updateScriptSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "The script update is incomplete.", details: parsed.error.flatten() }, { status: 400 });
    const context = await managerContext();
    const exists = (await context.db.select({ id: scripts.id }).from(scripts).where(and(eq(scripts.id, id), eq(scripts.organizationId, context.organization.id))).limit(1))[0];
    if (!exists) throw new MutationError(404, "Script not found");
    let nextVersion = 0;
    await context.db.transaction(async (transaction) => {
      // Lock the script row so concurrent saves cannot pick the same version
      // number and collide on script_versions_script_version_unique.
      const current = (await transaction.select().from(scripts).where(and(eq(scripts.id, id), eq(scripts.organizationId, context.organization.id))).limit(1).for("update"))[0];
      if (!current) throw new MutationError(404, "Script not found");
      nextVersion = current.latestVersion + 1;
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await managerContext();
    let title = "Script";
    let assignmentCount = 0;
    let canceledNotificationCount = 0;
    let canceledNotificationIds: string[] = [];
    let blobUrls: string[] = [];

    await context.db.transaction(async (transaction) => {
      const script = (await transaction
        .select({ id: scripts.id, title: scripts.title })
        .from(scripts)
        .where(and(eq(scripts.id, id), eq(scripts.organizationId, context.organization.id)))
        .limit(1)
        .for("update"))[0];
      if (!script) throw new MutationError(404, "Script not found");
      title = script.title;
      const assets = await transaction.select({ sourceUrl:scriptAssets.sourceUrl,metadata:scriptAssets.metadata }).from(scriptAssets).where(and(eq(scriptAssets.scriptId,id),eq(scriptAssets.organizationId,context.organization.id)));
      blobUrls = assets.filter((asset)=>asset.metadata.storage==="vercel_blob").map((asset)=>asset.sourceUrl).filter((value):value is string=>Boolean(value&&isVercelBlobUrl(value)));

      const assignments = await transaction
        .select({ discordOperationId: scriptAssignments.discordOperationId })
        .from(scriptAssignments)
        .where(and(eq(scriptAssignments.scriptId, id), eq(scriptAssignments.organizationId, context.organization.id)));
      assignmentCount = assignments.length;
      const operationIds = assignments
        .map((assignment) => assignment.discordOperationId)
        .filter((operationId): operationId is string => Boolean(operationId));

      if (operationIds.length) {
        const operations = await transaction
          .select({ id: discordOperations.id, state: discordOperations.state })
          .from(discordOperations)
          .where(and(
            eq(discordOperations.organizationId, context.organization.id),
            inArray(discordOperations.id, operationIds),
          ))
          .for("update");
        if (operations.some((operation) => operation.state === "running")) {
          throw new MutationError(409, "A Discord notification is being delivered. Try deleting this script again in a moment.");
        }
        const cancellableIds = operations
          .filter((operation) => operation.state === "queued" || operation.state === "failed")
          .map((operation) => operation.id);
        if (cancellableIds.length) {
          const canceled = await transaction
            .delete(discordOperations)
            .where(and(
              eq(discordOperations.organizationId, context.organization.id),
              inArray(discordOperations.id, cancellableIds),
            ))
            .returning({ id: discordOperations.id });
          canceledNotificationCount = canceled.length;
          canceledNotificationIds = canceled.map((operation) => operation.id);
        }
      }

      await transaction.insert(activityEvents).values({
        organizationId: context.organization.id,
        actorUserId: context.internalUser?.id ?? null,
        type: "script.deleted",
        summary: `Script “${script.title}” was deleted.`,
        metadata: { scriptId: id, assignmentCount, canceledNotificationCount },
      });
      const deleted = await transaction
        .delete(scripts)
        .where(and(eq(scripts.id, id), eq(scripts.organizationId, context.organization.id)))
        .returning({ id: scripts.id });
      if (!deleted.length) throw new MutationError(404, "Script not found");
    });

    if (blobUrls.length) {
      try { await del(blobUrls); } catch (error) { console.error("Could not delete script asset blobs",error); }
    }

    invalidatePortalData();
    return Response.json({ ok: true, title, assignmentCount, canceledNotificationCount, canceledNotificationIds });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

function isVercelBlobUrl(value:string):boolean {
  try { return new URL(value).hostname.endsWith(".blob.vercel-storage.com"); } catch { return false; }
}
