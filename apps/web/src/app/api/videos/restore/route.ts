import { z } from "zod";
import { activityEvents, socialAccounts, videos as storedVideos } from "@result/db";
import { and, eq } from "drizzle-orm";
import { managerContext, mutationErrorResponse } from "@/lib/mutation-context";
import { restoreViralVideos } from "@/lib/viral";
import { invalidatePortalData } from "@/lib/portal-cache";

const schema = z.object({ videos: z.array(z.object({ accountId: z.string().startsWith("orgacc_"), platform: z.enum(["facebook", "instagram", "tiktok", "youtube", "snapchat"]), platformVideoId: z.string().min(1) })).min(1).max(100) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid restoration request" }, { status: 400 });
  try {
    const context = await managerContext();
    const result = await restoreViralVideos(parsed.data.videos.map(({ platform, platformVideoId }) => ({ platform, platformVideoId })));
    for (const video of parsed.data.videos) {
      const account = (await context.db.select({ id: socialAccounts.id, creatorId: socialAccounts.creatorId }).from(socialAccounts).where(and(eq(socialAccounts.organizationId, context.organization.id), eq(socialAccounts.viralOrgAccountId, video.accountId))).limit(1))[0];
      if (account) await context.db.update(storedVideos).set({ included: true, exclusionReason: null, excludedAt: null, excludedByUserId: null, updatedAt: new Date() }).where(and(eq(storedVideos.accountId, account.id), eq(storedVideos.platformVideoId, video.platformVideoId)));
      await context.db.insert(activityEvents).values({ organizationId: context.organization.id, creatorId: account?.creatorId ?? null, actorUserId: context.internalUser?.id ?? null, type: "video.restored", summary: "Video restored to Result performance totals.", metadata: video });
    }
    invalidatePortalData();
    return Response.json({ ok: true, result });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
