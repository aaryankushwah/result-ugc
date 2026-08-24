import { activityEvents, creators, socialAccounts } from "@result/db";
import { and, eq } from "drizzle-orm";
import { managerContext, mutationErrorResponse } from "@/lib/mutation-context";
import { syncViralSnapshots } from "@/lib/viral-sync";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const context = await managerContext();
    let account = (await context.db.select().from(socialAccounts).where(and(eq(socialAccounts.organizationId, context.organization.id), eq(socialAccounts.viralOrgAccountId, id))).limit(1))[0];
    if (!account) { await syncViralSnapshots(); account = (await context.db.select().from(socialAccounts).where(and(eq(socialAccounts.organizationId, context.organization.id), eq(socialAccounts.viralOrgAccountId, id))).limit(1))[0]; }
    if (!account) return Response.json({ error: "Tracked account not found" }, { status: 404 });
    if (account.creatorId && account.linkState === "confirmed") return Response.json({ ok: true, creatorId: account.creatorId });
    const [creator] = await context.db.insert(creators).values({ organizationId: context.organization.id, displayName: account.displayName ?? account.username ?? "New creator", lifecycle: "request", attentionState: "Discord and signing confirmation required", nextStep: "Link Discord identity and confirm signing provider", lastActivityAt: new Date() }).returning({ id: creators.id });
    if (!creator) throw new Error("Creator could not be created");
    await context.db.update(socialAccounts).set({ creatorId: creator.id, linkState: "confirmed", linkedByUserId: context.internalUser?.id ?? null, linkedAt: new Date(), updatedAt: new Date() }).where(eq(socialAccounts.id, account.id));
    await context.db.insert(activityEvents).values({ organizationId: context.organization.id, creatorId: creator.id, actorUserId: context.internalUser?.id ?? null, type: "account.promoted_to_creator", summary: `@${account.username ?? "account"} was confirmed as a new Result creator.`, metadata: { viralOrgAccountId: account.viralOrgAccountId, platform: account.platform } });
    return Response.json({ ok: true, creatorId: creator.id });
  } catch (error) { return mutationErrorResponse(error); }
}
