import { z } from "zod";
import { activityEvents, socialAccounts, videos as storedVideos } from "@result/db";
import { and, eq } from "drizzle-orm";
import { excludeViralVideos } from "@/lib/viral";
import { managerContext, mutationErrorResponse } from "@/lib/mutation-context";
import { invalidatePortalData } from "@/lib/portal-cache";

const schema = z.object({ reason: z.enum(["warmup_unpaid"]), videos: z.array(z.object({ accountId: z.string().startsWith("orgacc_"), platform: z.enum(["facebook", "instagram", "tiktok", "youtube", "snapchat"]), platformAccountId: z.string().min(1), platformVideoId: z.string().min(1) })).min(1).max(100) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "Invalid exclusion request" }, { status: 400 });
  try {
    const context = await managerContext();
    const result = await excludeViralVideos(parsed.data.videos);
    for (const video of parsed.data.videos) {
      const account = (await context.db.select({ id: socialAccounts.id, creatorId: socialAccounts.creatorId }).from(socialAccounts).where(and(eq(socialAccounts.organizationId, context.organization.id), eq(socialAccounts.viralOrgAccountId, video.accountId))).limit(1))[0];
      if (account) await context.db.update(storedVideos).set({ included: false, exclusionReason: parsed.data.reason, excludedAt: new Date(), excludedByUserId: context.internalUser?.id ?? null, updatedAt: new Date() }).where(and(eq(storedVideos.accountId, account.id), eq(storedVideos.platformVideoId, video.platformVideoId)));
      await context.db.insert(activityEvents).values({ organizationId: context.organization.id, creatorId: account?.creatorId ?? null, actorUserId: context.internalUser?.id ?? null, type: "video.excluded", summary: "Video excluded as warmup or unpaid content.", metadata: { ...video, reason: parsed.data.reason } });
    }
    invalidatePortalData();
    return Response.json({ ok: true, result });
  } catch (error) { return mutationErrorResponse(error); }
}
