import { activityEvents, creators, socialAccounts } from "@result/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { managerContext, mutationErrorResponse } from "@/lib/mutation-context";

const schema = z.object({ creatorId: z.string().uuid() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const parsed = schema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "Invalid creator" }, { status: 400 }); const context = await managerContext(); const creator = (await context.db.select({ id: creators.id }).from(creators).where(and(eq(creators.organizationId, context.organization.id), eq(creators.id, parsed.data.creatorId))).limit(1))[0]; if (!creator) return Response.json({ error: "Creator not found" }, { status: 404 }); const updated = await context.db.update(socialAccounts).set({ creatorId: creator.id, linkState: "confirmed", linkedByUserId: context.internalUser?.id ?? null, linkedAt: new Date(), updatedAt: new Date() }).where(and(eq(socialAccounts.organizationId, context.organization.id), eq(socialAccounts.viralOrgAccountId, id))).returning({ username: socialAccounts.username }); if (!updated[0]) return Response.json({ error: "Account not found" }, { status: 404 }); await context.db.insert(activityEvents).values({ organizationId: context.organization.id, creatorId: creator.id, actorUserId: context.internalUser?.id ?? null, type: "account.linked", summary: `@${updated[0].username ?? "account"} was linked to this creator.`, metadata: { viralOrgAccountId: id } }); return Response.json({ ok: true }); } catch (error) { return mutationErrorResponse(error); }
}
