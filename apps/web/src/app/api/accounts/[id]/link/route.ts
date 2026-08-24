import { activityEvents, creators, socialAccounts } from "@result/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { managerContext, mutationErrorResponse } from "@/lib/mutation-context";
import { invalidatePortalData } from "@/lib/portal-cache";

const schema = z.object({ creatorId: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid creator" }, { status: 400 });
    const context = await managerContext();
    const [creator, account] = await Promise.all([
      context.db.select({ id: creators.id, displayName: creators.displayName }).from(creators).where(and(eq(creators.organizationId, context.organization.id), eq(creators.id, parsed.data.creatorId))).limit(1).then((rows) => rows[0]),
      context.db.select({ id: socialAccounts.id, username: socialAccounts.username, creatorId: socialAccounts.creatorId, linkState: socialAccounts.linkState }).from(socialAccounts).where(and(eq(socialAccounts.organizationId, context.organization.id), eq(socialAccounts.viralOrgAccountId, id))).limit(1).then((rows) => rows[0]),
    ]);
    if (!creator) return Response.json({ error: "Creator not found" }, { status: 404 });
    if (!account) return Response.json({ error: "Account not found" }, { status: 404 });

    const previousCreatorId = account.creatorId;
    await context.db.update(socialAccounts).set({
      creatorId: creator.id,
      suggestedCreatorId: null,
      linkState: "confirmed",
      linkConfidence: 1,
      linkedByUserId: context.internalUser?.id ?? null,
      linkedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(socialAccounts.id, account.id));

    const username = account.username ?? "account";
    await context.db.insert(activityEvents).values({
      organizationId: context.organization.id,
      creatorId: creator.id,
      actorUserId: context.internalUser?.id ?? null,
      type: previousCreatorId && previousCreatorId !== creator.id ? "account.reassigned" : account.linkState === "suggested" ? "account.match_confirmed" : "account.linked",
      summary: previousCreatorId && previousCreatorId !== creator.id ? `@${username} was reassigned to ${creator.displayName}.` : `@${username} was assigned to this creator.`,
      metadata: { viralOrgAccountId: id, previousCreatorId },
    });
    if (previousCreatorId && previousCreatorId !== creator.id) {
      await context.db.insert(activityEvents).values({ organizationId: context.organization.id, creatorId: previousCreatorId, actorUserId: context.internalUser?.id ?? null, type: "account.reassigned_away", summary: `@${username} was reassigned to ${creator.displayName}.`, metadata: { viralOrgAccountId: id, newCreatorId: creator.id } });
    }

    invalidatePortalData();
    return Response.json({ ok: true, creatorId: creator.id });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await managerContext();
    const account = (await context.db.select({ id: socialAccounts.id, username: socialAccounts.username, creatorId: socialAccounts.creatorId }).from(socialAccounts).where(and(eq(socialAccounts.organizationId, context.organization.id), eq(socialAccounts.viralOrgAccountId, id))).limit(1))[0];
    if (!account) return Response.json({ error: "Account not found" }, { status: 404 });

    await context.db.update(socialAccounts).set({ creatorId: null, suggestedCreatorId: null, linkState: "unlinked", linkConfidence: null, linkedByUserId: null, linkedAt: null, updatedAt: new Date() }).where(eq(socialAccounts.id, account.id));
    if (account.creatorId) {
      await context.db.insert(activityEvents).values({ organizationId: context.organization.id, creatorId: account.creatorId, actorUserId: context.internalUser?.id ?? null, type: "account.unassigned", summary: `@${account.username ?? "account"} was unassigned from this creator.`, metadata: { viralOrgAccountId: id } });
    }

    invalidatePortalData();
    return Response.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
