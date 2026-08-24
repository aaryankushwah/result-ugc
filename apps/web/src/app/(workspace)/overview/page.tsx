import { AlertTriangle, ArrowUpRight, FileVideo2, Link2, Radio } from "lucide-react";
import Link from "next/link";
import { OverviewMetricGrid, OverviewMetricPicker, type OverviewMetric } from "@/components/overview-metrics";
import { PerformanceChart } from "@/components/performance-chart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatNumber, formatPercent, PageTitle, StateBadge, timeAgo, TrackingBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getPortalData } from "@/lib/portal-data";

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireUser();
  const [data, params] = await Promise.all([getPortalData(), searchParams]);
  const range = ["7", "14", "30"].includes(params.range ?? "") ? Number(params.range) : 30;
  const performance = data.performance.slice(-range);
  const includedVideos = data.videos.filter((video) => video.included);
  const totals = {
    active: data.creators.filter((creator) => creator.lifecycle === "active").length,
    applicants: data.creators.filter((creator) => creator.lifecycle === "request").length,
    accounts: data.accounts.length,
    videos: includedVideos.length,
    views: includedVideos.reduce((sum, video) => sum + video.views, 0),
    likes: includedVideos.reduce((sum, video) => sum + video.likes, 0),
    comments: includedVideos.reduce((sum, video) => sum + video.comments, 0),
    shares: includedVideos.reduce((sum, video) => sum + video.shares, 0),
    bookmarks: includedVideos.reduce((sum, video) => sum + video.bookmarks, 0),
    engagement: includedVideos.reduce((sum, video) => sum + video.likes + video.comments + video.shares + video.bookmarks, 0) / Math.max(1, includedVideos.reduce((sum, video) => sum + video.views, 0)),
  };
  const attention = data.creators.filter((creator) => creator.attentionState || creator.discord.state !== "connected" || creator.relationships.length === 0).length;
  const exceptions = [
    { label: "Account awaiting creator match", count: data.accounts.filter((account) => account.linkState !== "confirmed").length, href: "/creators?tab=requests", tone: "attention" as const },
    { label: "Discord access not reconciled", count: data.creators.filter((creator) => creator.discord.state !== "connected").length, href: "/creators?discord=missing_access", tone: "attention" as const },
    { label: "No signing relationship", count: data.creators.filter((creator) => creator.relationships.length === 0).length, href: "/creators?provider=unlinked", tone: "neutral" as const },
    { label: "Tracking stale or failed", count: data.accounts.filter((account) => account.trackingState === "stale" || account.trackingState === "failed").length, href: "/accounts?health=stale", tone: "neutral" as const },
  ];
  const metricCards: OverviewMetric[] = [
    { id: "active", label: "Active creators", value: formatNumber(totals.active), icon: "creators" },
    { id: "applicants", label: "Applicants", value: formatNumber(totals.applicants), icon: "applicants" },
    { id: "accounts", label: "Tracked accounts", value: formatNumber(totals.accounts), icon: "accounts" },
    { id: "videos", label: "Posted videos", value: formatNumber(totals.videos), icon: "video" },
    { id: "views", label: "Views", value: formatNumber(totals.views), icon: "eye" },
    { id: "averageViews", label: "Average views", value: formatNumber(totals.views / Math.max(1, totals.videos)), icon: "gauge" },
    { id: "likes", label: "Likes", value: formatNumber(totals.likes), icon: "heart" },
    { id: "comments", label: "Comments", value: formatNumber(totals.comments), icon: "comments" },
    { id: "shares", label: "Shares", value: formatNumber(totals.shares), icon: "share" },
    { id: "bookmarks", label: "Bookmarks", value: formatNumber(totals.bookmarks), icon: "bookmark" },
    { id: "engagement", label: "Engagement", value: formatPercent(totals.engagement), icon: "activity" },
    { id: "attention", label: "Needs attention", value: formatNumber(attention), icon: "alert", attention: true },
  ];
  const topAccounts = [...data.accounts].sort((a, b) => b.views - a.views).slice(0, 5);
  const topVideos = [...includedVideos].sort((a, b) => b.views - a.views).slice(0, 5);

  const degraded = data.freshness.filter((item) => item.state === "failed" || item.state === "stale");
  return <div className="page-stack">
    <PageTitle eyebrow="MANAGER COMMAND CENTER" title="Result" titleClassName="font-result result-ugc-title" description="The operating picture across creators, Discord, signing providers, accounts, and performance." actions={<><OverviewMetricPicker metrics={metricCards} /><Button variant="outline"><Link2 /> Copy this view</Button></>} />
    {data.sourceMode === "live_provider" ? <div className="source-banner"><Radio /><div><strong>Live Viral data is connected.</strong><span>Creator candidates need confirmation after the shared database is connected; they are not silently treated as signed creators.</span></div><Link href="/integrations">Review setup <ArrowUpRight /></Link></div> : null}
    {degraded.length ? <div className="source-banner source-warning"><AlertTriangle /><div><strong>Showing the last successful snapshot.</strong><span>{degraded.map((item) => `${item.source}: ${item.message ?? item.state}`).join(" · ")}</span></div><Link href="/integrations">View sources <ArrowUpRight /></Link></div> : null}
    <OverviewMetricGrid metrics={metricCards} />
    <section className="dashboard-grid dashboard-main-grid">
      <Card className="panel chart-panel"><div className="panel-header"><div><h2>Performance</h2><p>Dithered included-video views by publish date</p></div><div className="range-tabs">{[7, 14, 30].map((days) => <Link key={days} href={`/overview?range=${days}`} className={range === days ? "active" : ""}>{days}d</Link>)}</div></div><PerformanceChart data={performance} /><div className="chart-legend"><span><i className="legend-views" />Views</span></div></Card>
      <article className="panel exceptions-panel"><div className="panel-header"><div><h2>Exceptions</h2><p>Work that needs a manager</p></div><StateBadge label={`${exceptions.reduce((sum, item) => sum + item.count, 0)} open`} tone="attention" /></div><div className="exception-list">{exceptions.map((item) => <Link key={item.label} href={item.href}><span className={`exception-count ${item.tone}`}>{item.count}</span><strong>{item.label}</strong><ArrowUpRight /></Link>)}</div></article>
    </section>
    <section className="dashboard-grid split-grid">
      <article className="panel table-panel"><div className="panel-header"><div><h2>Top accounts</h2><p>Current tracked totals</p></div><Link href="/accounts" className="text-link">View all <ArrowUpRight /></Link></div><div className="rank-list">{topAccounts.map((account, index) => <Link href={`/accounts/${encodeURIComponent(account.id)}`} key={account.id}><span className="rank">{String(index + 1).padStart(2, "0")}</span><span className="account-avatar">{account.avatarUrl ? <img src={account.avatarUrl} alt="" /> : account.username.slice(0, 1).toUpperCase()}</span><span className="rank-copy"><strong>@{account.username}</strong><small>{account.platform} · {formatNumber(account.followers ?? 0)} followers</small></span><b>{formatNumber(account.views)}</b><TrackingBadge state={account.trackingState} /></Link>)}</div></article>
      <article className="panel table-panel"><div className="panel-header"><div><h2>Top videos</h2><p>Ranked by tracked views</p></div><Link href="/videos" className="text-link">View all <ArrowUpRight /></Link></div><div className="rank-list video-rank-list">{topVideos.map((video, index) => <Link href={`/videos/${encodeURIComponent(video.id)}`} key={video.id}><span className="rank">{String(index + 1).padStart(2, "0")}</span><span className="video-thumb">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" /> : <FileVideo2 />}</span><span className="rank-copy"><strong>{video.caption}</strong><small>@{video.accountUsername} · {formatPercent(video.engagementRate)}</small></span><b>{formatNumber(video.views)}</b></Link>)}</div></article>
    </section>
    <section className="freshness-strip">{data.freshness.map((source) => <div key={source.source}><span className={`freshness-dot ${source.state}`} /><span><strong>{source.source}</strong><small>{source.message ?? source.state}</small></span><b>{timeAgo(source.lastSuccessAt)}</b></div>)}</section>
  </div>;
}
