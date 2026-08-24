import "server-only";

/**
 * Every model call routes through the Vercel AI Gateway, which resolves auth as:
 *   1. AI_GATEWAY_API_KEY  (static, works locally and in CI)
 *   2. VERCEL_OIDC_TOKEN   (auto-refreshed on Vercel deployments)
 * We hold no Anthropic or OpenAI key of our own.
 */
export function hasGatewayCredentials(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

export const GATEWAY_MISSING_MESSAGE =
  "AI Gateway is not configured. Set AI_GATEWAY_API_KEY, or run `vercel env pull` while linked to the Foundative team.";
