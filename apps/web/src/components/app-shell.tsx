"use client";

import { Activity, BarChart3, Bot, ChevronDown, CircleUserRound, FileCheck2, Menu, PanelLeftClose, PanelLeftOpen, Search, Settings, UsersRound, Video, X, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PortalUser } from "@/lib/auth";

const nav = [
  { label: "Workspace", items: [
    { href: "/overview", label: "Overview", icon: BarChart3 }, { href: "/creators", label: "Creators", icon: UsersRound },
    { href: "/accounts", label: "Accounts", icon: CircleUserRound }, { href: "/videos", label: "Videos", icon: Video },
  ] },
  { label: "Operations", items: [
    { href: "/onboarding", label: "Onboarding", icon: FileCheck2 }, { href: "/activity", label: "Activity", icon: Activity },
  ] },
  { label: "Organization", items: [
    { href: "/integrations", label: "Integrations", icon: Zap }, { href: "/settings", label: "Settings", icon: Settings },
  ] },
];

type CreatorOption = { id: string; displayName: string; username: string | null };

export function AppShell({ children, user, creators }: { children: React.ReactNode; user: PortalUser; creators: CreatorOption[] }) {
  const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const [paletteOpen, setPaletteOpen] = useState(false); const pathname = usePathname();
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen((open) => !open); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []);
  return <div className={`app-frame ${collapsed ? "sidebar-collapsed" : ""}`}>
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-brand"><Link href="/overview" className="brand-lockup"><span className="brand-mark font-result">R</span><span className="brand-text"><strong>Result</strong><small>UGC Workspace</small></span></Link><button className="icon-button desktop-only" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button><button className="icon-button mobile-only" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></button></div>
      <button className="command-trigger" onClick={() => setPaletteOpen(true)}><Search /><span>Search or jump to</span><kbd>⌘K</kbd></button>
      <nav className="sidebar-nav">{nav.map((group) => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map((item) => { const active = pathname === item.href || (item.href !== "/overview" && pathname.startsWith(`${item.href}/`)); return <Link href={item.href} key={item.href} className={active ? "active" : ""} title={collapsed ? item.label : undefined} onClick={() => setMobileOpen(false)}><item.icon /><span>{item.label}</span></Link>; })}</div>)}</nav>
      <div className="sidebar-user"><span className="user-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.name.slice(0, 1).toUpperCase()}</span><span className="user-copy"><strong>{user.name}</strong><small>{user.role.replace("_", " ")}</small></span><form action="/api/auth/logout" method="post"><button className="icon-button" title="Sign out" aria-label="Sign out"><ChevronDown /></button></form></div>
    </aside>
    <div className="workspace"><header className="topbar"><button className="icon-button mobile-only" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu /></button><Breadcrumb pathname={pathname} /><div className="topbar-actions"><span className="environment-pill"><Bot /> Internal workspace</span></div></header><main className="workspace-content">{children}</main></div>
    {paletteOpen ? <CommandPalette creators={creators} close={() => setPaletteOpen(false)} /> : null}
  </div>;
}

function Breadcrumb({ pathname }: { pathname: string }) { const root = pathname.split("/").filter(Boolean)[0] ?? "overview"; const section = nav.find((group) => group.items.some((item) => item.href === `/${root}`))?.label ?? "Workspace"; return <div className="breadcrumb"><span>{section}</span><span>›</span><strong>{root.slice(0, 1).toUpperCase() + root.slice(1)}</strong></div>; }

function CommandPalette({ creators, close }: { creators: CreatorOption[]; close: () => void }) {
  const [query, setQuery] = useState(""); const inputRef = useRef<HTMLInputElement>(null); const router = useRouter();
  useEffect(() => { inputRef.current?.focus(); }, []); useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === "Escape") close(); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [close]);
  const results = useMemo(() => { const normalized = query.toLowerCase().trim(); const pages = nav.flatMap((group) => group.items).filter((item) => !normalized || item.label.toLowerCase().includes(normalized)).map((item) => ({ id: item.href, label: item.label, sub: "Page", href: item.href, icon: item.icon })); const people = creators.filter((creator) => !normalized || `${creator.displayName} ${creator.username ?? ""}`.toLowerCase().includes(normalized)).slice(0, 8).map((creator) => ({ id: creator.id, label: creator.displayName, sub: creator.username ? `@${creator.username}` : "Creator", href: `/creators/${creator.id}`, icon: UsersRound })); return [...pages, ...people].slice(0, 12); }, [query, creators]);
  const go = (href: string) => { router.push(href); close(); };
  return <div className="command-backdrop" onMouseDown={close}><section className="command-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command menu"><div className="command-input"><Search /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search creators or jump to a page…" /><kbd>ESC</kbd></div><div className="command-results">{results.length ? results.map((result) => <button key={result.id} onClick={() => go(result.href)}><span className="command-result-icon"><result.icon /></span><span><strong>{result.label}</strong><small>{result.sub}</small></span><span className="command-enter">↵</span></button>) : <div className="empty-command">No result for “{query}”</div>}</div></section></div>;
}
