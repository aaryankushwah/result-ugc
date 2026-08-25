"use client";

import { Activity, BarChart3, Bot, ChevronDown, FileCheck2, FilePenLine, Menu, Moon, MousePointerClick, PanelLeftClose, PanelLeftOpen, Search, Settings, Sun, UsersRound, Video, X, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import type { PortalUser } from "@/lib/auth";
import { nextTheme, themeCookie, themeFromRoot, type Theme } from "@/lib/theme";

const nav = [
  { label: "Workspace", items: [
    { href: "/overview", label: "Overview", icon: BarChart3 }, { href: "/creators", label: "Creators", icon: UsersRound },
    { href: "/videos", label: "Videos", icon: Video },
    { href: "/attribution", label: "Attribution", icon: MousePointerClick },
  ] },
  { label: "Operations", items: [
    { href: "/scripts", label: "Script Studio", icon: FilePenLine }, { href: "/onboarding", label: "Onboarding", icon: FileCheck2 }, { href: "/activity", label: "Activity", icon: Activity },
  ] },
  { label: "Organization", items: [
    { href: "/integrations", label: "Integrations", icon: Zap }, { href: "/settings", label: "Settings", icon: Settings },
  ] },
];

type CreatorOption = { id: string; displayName: string; username: string | null };

// startViewTransition is not in every TS DOM lib yet; treat it as optional.
type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => { ready: Promise<void> } };

export function AppShell({ children, user, creators }: { children: React.ReactNode; user: PortalUser; creators: CreatorOption[] }) {
  const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const [paletteOpen, setPaletteOpen] = useState(false); const pathname = usePathname();
  const theme = useSyncExternalStore(
    (notify) => { window.addEventListener("result-theme-change", notify); return () => window.removeEventListener("result-theme-change", notify); },
    () => themeFromRoot(document.documentElement.className, document.documentElement.dataset.theme),
    (): Theme => "light",
  );
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen((open) => !open); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []);
  const applyTheme = (value: Theme) => { const root = document.documentElement; root.classList.remove("dark", "light"); root.classList.add(value); root.dataset.theme = value; document.cookie = themeCookie(value); try { window.localStorage.setItem("result-theme", value); } catch { /* The cookie is the persistence fallback. */ } window.dispatchEvent(new Event("result-theme-change")); };
  // Reveal the incoming theme as a circle growing from the toggle. Without the
  // View Transitions API, or when motion is reduced, the switch stays instant.
  const toggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    const value = nextTheme(theme);
    const startViewTransition = (document as ViewTransitionDocument).startViewTransition?.bind(document);
    if (!startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { applyTheme(value); return; }
    const box = event.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    // flushSync so the icon and label are repainted before the snapshot is taken.
    startViewTransition(() => flushSync(() => applyTheme(value))).ready
      .then(() => document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 460, easing: "cubic-bezier(.4, 0, .2, 1)", pseudoElement: "::view-transition-new(root)" },
      ))
      // Chrome aborts transitions in a hidden tab and skips the callback with
      // it, so re-apply: without this the theme silently fails to change.
      .catch(() => applyTheme(value));
  };
  return <div className={`app-frame ${collapsed ? "sidebar-collapsed" : ""}`}>
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-controls"><Button variant="ghost" size="icon-sm" className="icon-button desktop-only" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button><Button variant="ghost" size="icon-sm" className="icon-button mobile-only" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></Button></div>
      <Button variant="outline" className="command-trigger" onClick={() => setPaletteOpen(true)}><Search /><span>Search or jump to</span><kbd>⌘K</kbd></Button>
      <nav className="sidebar-nav">{nav.map((group) => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map((item) => { const active = pathname === item.href || (item.href !== "/overview" && pathname.startsWith(`${item.href}/`)); return <Link href={item.href} key={item.href} className={active ? "active" : ""} title={collapsed ? item.label : undefined} onClick={() => setMobileOpen(false)}><item.icon /><span>{item.label}</span></Link>; })}</div>)}</nav>
      <div className="sidebar-user"><Avatar className="user-avatar"><AvatarImage src={user.avatarUrl ?? undefined} alt="" /><AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><span className="user-copy"><strong>{user.name}</strong><small>{user.role.replace("_", " ")}</small></span><form action="/api/auth/logout" method="post"><Button variant="ghost" size="icon-sm" className="icon-button" title="Sign out" aria-label="Sign out"><ChevronDown /></Button></form></div>
    </aside>
    <div className="workspace"><header className="topbar"><Button variant="ghost" size="icon-sm" className="icon-button mobile-only" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu /></Button><Breadcrumb pathname={pathname} /><div className="topbar-actions"><Button variant="outline" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? <Moon /> : <Sun />}<span>{theme === "light" ? "Dark" : "Light"}</span></Button><span className="environment-pill"><Bot /> Internal workspace</span></div></header><main className="workspace-content">{children}</main></div>
    <CommandPalette creators={creators} open={paletteOpen} setOpen={setPaletteOpen} />
  </div>;
}

function Breadcrumb({ pathname }: { pathname: string }) { const root = pathname.split("/").filter(Boolean)[0] ?? "overview"; const section = nav.find((group) => group.items.some((item) => item.href === `/${root}`))?.label ?? "Workspace"; return <div className="breadcrumb"><span>{section}</span><span>›</span><strong>{root.slice(0, 1).toUpperCase() + root.slice(1)}</strong></div>; }

function CommandPalette({ creators, open, setOpen }: { creators: CreatorOption[]; open: boolean; setOpen: (open: boolean) => void }) {
  const router = useRouter();
  const go = (href: string) => { router.push(href); setOpen(false); };
  return <CommandDialog open={open} onOpenChange={setOpen} title="Result command menu" description="Search creators or navigate the manager workspace." className="command-dialog sm:max-w-xl"><Command><CommandInput placeholder="Search creators or jump to a page…" /><CommandList><CommandEmpty>No matching creator or page.</CommandEmpty><CommandGroup heading="Navigation">{nav.flatMap((group) => group.items).map((item) => <CommandItem key={item.href} value={`${item.label} ${item.href}`} onSelect={() => go(item.href)}><item.icon /><span>{item.label}</span><CommandShortcut>Page</CommandShortcut></CommandItem>)}</CommandGroup><CommandGroup heading="Creators">{creators.map((creator) => <CommandItem key={creator.id} value={`${creator.displayName} ${creator.username ?? ""}`} onSelect={() => go(`/creators/${creator.id}`)}><UsersRound /><span>{creator.displayName}</span><CommandShortcut>{creator.username ? `@${creator.username}` : "Creator"}</CommandShortcut></CommandItem>)}</CommandGroup></CommandList></Command></CommandDialog>;
}
