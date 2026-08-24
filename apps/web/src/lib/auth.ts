import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "result_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type PortalUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: "admin" | "ugc_manager" | "viewer";
};

function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production");
  return new TextEncoder().encode(secret ?? "result-local-preview-session-secret-change-me");
}

export async function createSession(user: PortalUser): Promise<void> {
  const token = await new SignJWT({ name: user.name, avatarUrl: user.avatarUrl, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionKey());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<PortalUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] });
      if (payload.sub && typeof payload.name === "string" && typeof payload.role === "string") {
        return {
          id: payload.sub,
          name: payload.name,
          avatarUrl: typeof payload.avatarUrl === "string" ? payload.avatarUrl : null,
          role: payload.role as PortalUser["role"],
        };
      }
    } catch {
      return null;
    }
  }
  if (process.env.NODE_ENV !== "production" && !process.env.DISCORD_CLIENT_ID) {
    return { id: "local-preview", name: "Result Team", avatarUrl: null, role: "admin" };
  }
  return null;
});

export async function requireUser(roles?: PortalUser["role"][]): Promise<PortalUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/forbidden");
  return user;
}

export function discordAuthConfigured(): boolean {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_GUILD_ID);
}

export function resolvePortalRole(memberRoleIds: string[]): PortalUser["role"] | null {
  const split = (value?: string) => new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean));
  const admins = split(process.env.DISCORD_ADMIN_ROLE_IDS);
  const managers = split(process.env.DISCORD_MANAGER_ROLE_IDS);
  const viewers = split(process.env.DISCORD_AUTHORIZED_ROLE_IDS);
  if (memberRoleIds.some((id) => admins.has(id))) return "admin";
  if (memberRoleIds.some((id) => managers.has(id))) return "ugc_manager";
  if (memberRoleIds.some((id) => viewers.has(id))) return "viewer";
  return null;
}
