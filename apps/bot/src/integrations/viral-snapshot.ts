const FIFTEEN_MINUTES = 15 * 60 * 1_000;

async function requestViralSnapshotSync(): Promise<void> {
  const portalUrl = process.env.RESULT_PORTAL_URL;
  const secret = process.env.RESULT_PORTAL_CRON_SECRET;
  if (!portalUrl || !secret) return;
  const response = await fetch(`${portalUrl.replace(/\/$/, "")}/api/cron/viral-sync`, {
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Portal Viral sync returned ${response.status}: ${(await response.text()).slice(0, 180)}`);
}

export function startViralSnapshotSchedule(onError: (error: unknown) => void): void {
  if (!process.env.RESULT_PORTAL_URL || !process.env.RESULT_PORTAL_CRON_SECRET) return;
  void requestViralSnapshotSync().catch(onError);
  setInterval(() => void requestViralSnapshotSync().catch(onError), FIFTEEN_MINUTES).unref();
}
