import { activityEvents, creators } from "@result/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { managerContext, mutationErrorResponse } from "@/lib/mutation-context";
import { invalidatePortalData } from "@/lib/portal-cache";

const schema = z.object({ lifecycle: z.enum(["request", "active", "watch", "offboarded"]).optional(), attentionState: z.string().max(500).nullable().optional(), nextStep: z.string().max(1000).nullable().optional() }).refine((value) => Object.keys(value).length > 0);
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const parsed = schema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "Invalid creator update" }, { status: 400 }); const context = await managerContext(); const [updated] = await context.db.update(creators).set({ ...parsed.data, lastActivityAt: new Date(), updatedAt: new Date() }).where(and(eq(creators.id, id), eq(creators.organizationId, context.organization.id))).returning({ id: creators.id }); if (!updated) return Response.json({ error: "Creator not found" }, { status: 404 }); await context.db.insert(activityEvents).values({ organizationId: context.organization.id, creatorId: id, actorUserId: context.internalUser?.id ?? null, type: "creator.updated", summary: "Creator management state was updated.", metadata: parsed.data }); invalidatePortalData(); return Response.json({ ok: true }); } catch (error) { return mutationErrorResponse(error); }
}
