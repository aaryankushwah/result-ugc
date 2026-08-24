import { discordOperations } from "@result/db";
import { and, eq } from "drizzle-orm";
import { managerContext, mutationErrorResponse } from "@/lib/mutation-context";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const context = await managerContext(); const [operation] = await context.db.update(discordOperations).set({ state: "queued", attempts: 0, availableAt: new Date(), lockedAt: null, finishedAt: null, lastError: null, updatedAt: new Date() }).where(and(eq(discordOperations.id, id), eq(discordOperations.organizationId, context.organization.id), eq(discordOperations.state, "failed"))).returning({ id: discordOperations.id }); if (!operation) return Response.json({ error: "Failed operation not found" }, { status: 404 }); return Response.json({ ok: true, operationId: operation.id }); } catch (error) { return mutationErrorResponse(error); }
}
