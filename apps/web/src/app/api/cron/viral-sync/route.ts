import { syncViralSnapshots } from "@/lib/viral-sync";
import { invalidatePortalData } from "@/lib/portal-cache";
import { syncLaunchpointSnapshots } from "@/lib/launchpoint-sync";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    let launchpoint: Awaited<ReturnType<typeof syncLaunchpointSnapshots>> | null = null;
    let launchpointError: string | null = null;
    if (process.env.LAUNCHPOINT_API_KEY) {
      try { launchpoint = await syncLaunchpointSnapshots(); }
      catch (error) { launchpointError = error instanceof Error ? error.message : "Launchpoint synchronization failed"; }
    }
    const viral = await syncViralSnapshots();
    invalidatePortalData();
    return Response.json({ ok: true, launchpoint, launchpointError, viral });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Viral synchronization failed" }, { status: 500 });
  }
}
