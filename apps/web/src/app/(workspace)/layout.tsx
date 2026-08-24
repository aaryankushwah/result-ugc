import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getPortalData } from "@/lib/portal-data";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [user, data] = await Promise.all([requireUser(), getPortalData()]);
  const creators = data.creators.map((creator) => ({ id: creator.id, displayName: creator.displayName, username: creator.discord.username ?? creator.accounts[0]?.username ?? null }));
  return <AppShell user={user} creators={creators}>{children}</AppShell>;
}
