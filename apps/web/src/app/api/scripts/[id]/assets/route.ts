import { activityEvents, scriptAssets, scripts } from "@result/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { managerContext, mutationErrorResponse, MutationError } from "@/lib/mutation-context";
import { invalidatePortalData } from "@/lib/portal-cache";

const createAssetSchema = z.object({
  label: z.string().trim().min(1).max(160),
  kind: z.enum(["reference_video", "image", "video", "audio", "file"]),
  sourceUrl: z.url().max(2_000),
  downloadUrl: z.url().max(2_000).nullable().optional(),
  metadata: z.record(z.string(),z.unknown()).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = createAssetSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Add a name and a valid resource URL.", details: parsed.error.flatten() }, { status: 400 });
    const context = await managerContext();
    const script = (await context.db.select({ id: scripts.id, title: scripts.title }).from(scripts).where(and(eq(scripts.id, id), eq(scripts.organizationId, context.organization.id))).limit(1))[0];
    if (!script) throw new MutationError(404, "Script not found");
    const asset = await context.db.transaction(async (transaction) => {
      const [created] = await transaction.insert(scriptAssets).values({
        organizationId: context.organization.id,
        scriptId: script.id,
        label: parsed.data.label,
        kind: parsed.data.kind,
        sourceUrl: parsed.data.sourceUrl,
        downloadUrl: parsed.data.downloadUrl ?? null,
        metadata: parsed.data.metadata ?? {},
        createdByUserId: context.internalUser?.id ?? null,
      }).returning({ id: scriptAssets.id, label: scriptAssets.label, kind: scriptAssets.kind, sourceUrl: scriptAssets.sourceUrl, downloadUrl: scriptAssets.downloadUrl });
      if (!created) throw new Error("Resource was not created");
      await transaction.insert(activityEvents).values({
        organizationId: context.organization.id,
        actorUserId: context.internalUser?.id ?? null,
        type: "script.asset_added",
        summary: `${parsed.data.kind === "reference_video" ? "Reference" : "Resource"} “${parsed.data.label}” was added to “${script.title}”.`,
        metadata: { scriptId: script.id, assetId: created.id, kind: parsed.data.kind },
      });
      return created;
    });
    invalidatePortalData();
    return Response.json({ ok: true, asset }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
