import { ArrowLeft, ExternalLink, Link2, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountAssignmentButton } from "@/components/creator-actions";
import { VideoTable } from "@/components/data-tables";
import { SourceImage } from "@/components/source-image";
import { formatNumber, formatPercent, StateBadge, timeAgo, TrackingBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getPortalData } from "@/lib/portal-data";
import { formatCpm } from "@/lib/launchpoint-cpm";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const [{ id }, data] = await Promise.all([params, getPortalData()]);
  const account = data.accounts.find((item) => item.id === id);
  if (!account) notFound();
  const creator = account.creatorId ? data.creators.find((item) => item.id === account.creatorId && item.source === "result") ?? null : null;
  const resultCreators = data.creators.filter((item) => item.source === "result").map((item) => ({ id: item.id, displayName: item.displayName, discordUsername: item.discord.username }));
  const accountVideos = data.videos.filter((video) => video.accountId === account.id);
  return <div className="page-stack creator-profile">
    <Link href="/accounts" className="back-link"><ArrowLeft /> All accounts</Link>
    <header className="profile-header"><div className="profile-identity"><span className="profile-avatar">{account.avatarUrl ? <SourceImage src={account.avatarUrl} width={56} height={56} /> : account.username.slice(0, 1).toUpperCase()}</span><div><div className="badge-row"><StateBadge label={account.platform} tone="info" /><StateBadge label={account.linkState} tone={account.linkState === "confirmed" ? "success" : "attention"} /><TrackingBadge state={account.trackingState} /></div><h1>@{account.username}</h1><p>{account.displayName}</p></div></div><div className="profile-actions">{account.sourceUrl ? <a className="secondary-button" href={account.sourceUrl} target="_blank" rel="noreferrer">Open profile <ExternalLink /></a> : null}</div></header>
    <section className="metric-grid profile-metrics">{[
      { label: "Realized CPM", value: formatCpm(account.realizedCpm) }, { label: "Followers", value: account.followers ?? 0 }, { label: "Posts", value: account.posts }, { label: "Views", value: account.views }, { label: "Average views", value: account.averageViews }, { label: "Engagement", value: formatPercent(account.engagementRate) },
    ].map((metric) => <article className="metric-card" key={metric.label}><div><p>{metric.label}</p><strong>{typeof metric.value === "number" ? formatNumber(metric.value) : metric.value}</strong></div></article>)}</section>
    <div className="profile-grid"><div className="profile-main"><section className="panel"><div className="panel-header"><div><h2>Tracked videos</h2><p>Durable Viral snapshots for this account</p></div></div><VideoTable videos={accountVideos} /></section></div><aside className="profile-aside"><section className="panel"><div className="panel-header"><div><h2>Canonical creator</h2><p>One human owns this account</p></div></div>{creator ? <div className="canonical-creator-card"><div className="canonical-creator-main"><span className="canonical-creator-icon"><UserRoundCheck /></span><span className="canonical-creator-copy"><strong>{creator.displayName}</strong><small>{creator.discord.username ? `Discord @${creator.discord.username}` : "Discord identity not reconciled"}</small></span></div><div className="canonical-creator-actions"><Link href={`/creators/${creator.id}`} className="secondary-button">Open Creator 360</Link><AccountAssignmentButton accountId={account.id} username={account.username} creators={resultCreators} currentCreatorId={creator.id} linkState={account.linkState} /></div>{account.linkState === "suggested" ? <p className="canonical-match-note">Exact-match suggestion. Confirm it before its metrics enter creator totals.</p> : null}</div> : <><div className="empty-state small"><Link2 /><strong>No creator confirmed</strong><p>Choose the existing Result creator. This will not create a duplicate.</p></div><div className="canonical-empty-action"><AccountAssignmentButton accountId={account.id} username={account.username} creators={resultCreators} currentCreatorId={null} linkState={account.linkState} /></div></>}</section><section className="panel"><div className="panel-header"><div><h2>Source identity</h2><p>Identifiers used for safe joins</p></div></div><dl className="details-grid"><div className="wide"><dt>Viral organization account</dt><dd>{account.id}</dd></div><div className="wide"><dt>Platform account</dt><dd>{account.platformAccountId}</dd></div><div><dt>Last source refresh</dt><dd>{timeAgo(account.refreshedAt)}</dd></div><div><dt>Latest post</dt><dd>{timeAgo(account.latestPostAt)}</dd></div></dl></section></aside></div>
  </div>;
}
