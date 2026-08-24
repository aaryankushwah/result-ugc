import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession, resolvePortalRole } from "@/lib/auth";

type DiscordToken = { access_token: string };
type DiscordUser = { id: string; username: string; global_name?: string | null; avatar?: string | null };
type DiscordMember = { roles: string[]; nick?: string | null };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("result_oauth_state")?.value;
  const verifier = cookieStore.get("result_oauth_verifier")?.value;
  cookieStore.delete("result_oauth_state");
  cookieStore.delete("result_oauth_verifier");
  if (!expectedState || expectedState !== url.searchParams.get("state") || !verifier) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
  }

  try {
    const redirectUri = `${url.origin}/api/auth/discord/callback`;
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code: url.searchParams.get("code") ?? "",
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });
    if (!tokenResponse.ok) throw new Error("Discord token exchange failed");
    const token = await tokenResponse.json() as DiscordToken;
    const headers = { authorization: `Bearer ${token.access_token}` };
    const [userResponse, memberResponse] = await Promise.all([
      fetch("https://discord.com/api/users/@me", { headers }),
      fetch(`https://discord.com/api/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`, { headers }),
    ]);
    if (!userResponse.ok || !memberResponse.ok) return NextResponse.redirect(new URL("/login?error=not_in_guild", request.url));
    const user = await userResponse.json() as DiscordUser;
    const member = await memberResponse.json() as DiscordMember;
    const role = resolvePortalRole(member.roles);
    if (!role) return NextResponse.redirect(new URL("/login?error=unauthorized_role", request.url));
    await createSession({
      id: user.id,
      name: member.nick ?? user.global_name ?? user.username,
      avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null,
      role,
    });
    return NextResponse.redirect(new URL("/overview", request.url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }
}
