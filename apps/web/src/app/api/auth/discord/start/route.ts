import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { discordAuthConfigured } from "@/lib/auth";

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export async function GET(request: Request) {
  if (!discordAuthConfigured()) return NextResponse.redirect(new URL("/login?error=not_configured", request.url));
  const state = base64Url(crypto.getRandomValues(new Uint8Array(24)));
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  cookieStore.set("result_oauth_state", state, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
  cookieStore.set("result_oauth_verifier", verifier, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });

  const redirectUri = `${new URL(request.url).origin}/api/auth/discord/callback`;
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "identify guilds.members.read");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return NextResponse.redirect(url);
}
