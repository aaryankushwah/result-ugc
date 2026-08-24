import { syncViralSnapshots } from "@/lib/viral-sync";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { return Response.json({ ok: true, ...(await syncViralSnapshots()) }); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Viral synchronization failed" }, { status: 500 }); }
}
