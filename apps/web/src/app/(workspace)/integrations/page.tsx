import { Bot, CheckCircle2, Database, ExternalLink, Radio, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageTitle, StateBadge, timeAgo } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getPortalData } from "@/lib/portal-data";

export default async function IntegrationsPage() {
  await requireUser();
  const data = await getPortalData();
  const source = (name: "viral" | "discord" | "launchpoint" | "sideshift") => data.freshness.find((item) => item.source === name);
  const integrations = [
    { id: "viral", name: "Viral.app", description: "Tracked accounts, videos, statistics, and native exclusions.", icon: Radio, state: source("viral")?.state ?? "failed", detail: `${data.accounts.length} accounts · ${data.videos.length} videos`, lastSuccessAt: source("viral")?.lastSuccessAt ?? null },
    { id: "discord", name: "Discord", description: "Authoritative membership, roles, private channels, and queued operations.", icon: Bot, state: source("discord")?.state ?? "not_configured", detail: `${data.creators.filter((creator) => creator.discord.state === "connected").length} connected creators`, lastSuccessAt: source("discord")?.lastSuccessAt ?? null },
    { id: "launchpoint", name: "Launchpoint", description: "Creators, signing relationships, programs, and social identity discovery.", icon: ShieldCheck, state: source("launchpoint")?.state ?? "not_configured", detail: `${data.creators.filter((creator) => creator.relationships.some((relationship) => relationship.provider === "launchpoint")).length} linked creators`, lastSuccessAt: source("launchpoint")?.lastSuccessAt ?? null },
    { id: "sideshift", name: "SideShift", description: "Manual verification now; API adapter later without profile redesign.", icon: ShieldCheck, state: "manual", detail: `${data.creators.filter((creator) => creator.relationships.some((relationship) => relationship.provider === "sideshift")).length} manual relationships`, lastSuccessAt: null },
    { id: "database", name: "Neon Postgres", description: "Canonical Result creators, mappings, audit history, and operation queue.", icon: Database, state: process.env.DATABASE_URL ? "fresh" : "not_configured", detail: process.env.DATABASE_URL ? "Connected" : "Database configuration required", lastSuccessAt: null },
  ];
  return <div className="page-stack"><PageTitle eyebrow="ORGANIZATION" title="Integrations" description="Source ownership, connection health, sync mode, and last successful refresh." /><section className="integration-grid">{integrations.map((integration) => <Card className="integration-card" key={integration.id}><div className="integration-card-head"><span className="large-icon"><integration.icon /></span><StateBadge label={integration.state} tone={integration.state === "fresh" ? "success" : integration.state === "manual" ? "info" : "neutral"} /></div><h2>{integration.name}</h2><p>{integration.description}</p><div className="integration-meta"><span>{integration.detail}</span>{integration.lastSuccessAt ? <strong>{timeAgo(integration.lastSuccessAt)}</strong> : null}</div><Button variant="outline">Configure <ExternalLink /></Button></Card>)}</section><div className="source-banner"><CheckCircle2 /><div><strong>One creator, multiple synchronized identities.</strong><span>Result owns the canonical creator. Discord supplies access, Launchpoint supplies signing, and Viral supplies social performance without blocking page loads.</span></div></div></div>;
}
