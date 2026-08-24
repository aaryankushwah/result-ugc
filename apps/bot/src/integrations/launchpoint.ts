const API_BASE = "https://dashboard.launchpointhq.com/api/v1";

export class LaunchpointApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "LaunchpointApiError";
  }
}

function apiKey(): string {
  const value = process.env.LAUNCHPOINT_API_KEY?.trim();
  if (!value) throw new Error("Launchpoint is not configured. Add LAUNCHPOINT_API_KEY to the bot host's .env.");
  return value;
}

export async function launchpointGet<T = unknown>(path: string, params: Record<string, string | undefined> = {}, timeoutMs = 12_000): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { "x-api-key": apiKey(), Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : `Launchpoint API request failed (${response.status}).`;
    throw new LaunchpointApiError(response.status, message);
  }
  return payload as T;
}
