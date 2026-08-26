import { activityEvents, scriptAssets, scripts } from "@result/db";
import { del } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { managerContext, mutationErrorResponse, MutationError } from "@/lib/mutation-context";
import { invalidatePortalData } from "@/lib/portal-cache";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  try {
    const { id, assetId } = await params;
    const context = await managerContext();
    const script = (await context.db.select({ id: scripts.id, title: scripts.title }).from(scripts).where(and(eq(scripts.id, id), eq(scripts.organizationId, context.organization.id))).limit(1))[0];
    if (!script) throw new MutationError(404, "Script not found");
    const removed = await context.db.transaction(async (transaction) => {
      const [deleted] = await transaction.delete(scriptAssets).where(and(eq(scriptAssets.id, assetId), eq(scriptAssets.scriptId, script.id), eq(scriptAssets.organizationId, context.organization.id))).returning({ id: scriptAssets.id, label: scriptAssets.label, kind: scriptAssets.kind, sourceUrl:scriptAssets.sourceUrl, metadata:scriptAssets.metadata });
      const removed = deleted;
      if (!removed) throw new MutationError(404, "Resource not found");
      await transaction.insert(activityEvents).values({
        organizationId: context.organization.id,
        actorUserId: context.internalUser?.id ?? null,
        type: "script.asset_removed",
        summary: `${removed.kind === "reference_video" ? "Reference" : "Resource"} “${removed.label}” was removed from “${script.title}”.`,
        metadata: { scriptId: script.id, assetId: removed.id, kind: removed.kind },
      });
      return removed;
    });
    if (removed.sourceUrl && removed.metadata.storage==="vercel_blob" && isVercelBlobUrl(removed.sourceUrl)) {
      try { await del(removed.sourceUrl); } catch (error) { console.error("Could not delete script asset blob",error); }
    }
    invalidatePortalData();
    return Response.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

function isVercelBlobUrl(value:string):boolean {
  try { return new URL(value).hostname.endsWith(".blob.vercel-storage.com"); } catch { return false; }
}
