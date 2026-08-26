import { AlertTriangle, ArrowUpRight, CalendarClock, ChevronRight, FileVideo2, MessageCircleMore, Radio, ShieldAlert, TrendingUp } from "lucide-react";
import Link from "next/link";
import { CopyOverviewViewButton, OverviewMetricGrid, OverviewMetricPicker, type OverviewMetric } from "@/components/overview-metrics";
import { PerformanceChart } from "@/components/performance-chart";
import { SourceImage } from "@/components/source-image";
import { Card } from "@/components/ui/card";
import { formatNumber, formatPercent, PageTitle, timeAgo, TrackingBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getPortalData } from "@/lib/portal-data";
import { creatorPostActivity } from "@/lib/table-metrics";
import { formatConfiguredCpm, formatCpm } from "@/lib/launchpoint-cpm";
import { buildOverviewSignals } from "@/lib/overview-signals";
import styles from "./overview.module.css";

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ range?: string; series?: string; stats?: string }> }) {
  await requireUser();
  const [data, params] = await Promise.all([getPortalData(), searchParams]);
  const range = ["7", "14", "30"].includes(params.range ?? "") ? Number(params.range) : 30;
  const preservedView = new URLSearchParams();
  if (params.series) preservedView.set("series", params.series);
  if (params.stats) preservedView.set("stats", params.stats);
  const performance = data.performance.slice(-range);
  const includedVideos = data.videos.filter((video) => video.included);
  const launchpoint = data.launchpointAnalytics;
  const totals = {
    active: data.creators.filter((creator) => creator.lifecycle === "active").length,
    applicants: data.creators.filter((creator) => creator.lifecycle === "request").length,
    accounts: data.accounts.length,
    videos: launchpoint?.totalPosts ?? includedVideos.length,
    views: launchpoint?.totalViews ?? includedVideos.reduce((sum, video) => sum + video.views, 0),
    likes: launchpoint?.totalLikes ?? includedVideos.reduce((sum, video) => sum + video.likes, 0),
    comments: launchpoint?.totalComments ?? includedVideos.reduce((sum, video) => sum + video.comments, 0),
    shares: launchpoint?.totalShares ?? includedVideos.reduce((sum, video) => sum + video.shares, 0),
    bookmarks: launchpoint?.totalBookmarks ?? includedVideos.reduce((sum, video) => sum + video.bookmarks, 0),
    engagement: 0,
  };
  totals.engagement = (totals.likes + totals.comments + totals.shares + totals.bookmarks) / Math.max(1, totals.views);
  const attention = data.creators.filter((creator) => creator.attentionState || creator.discord.state !== "connected" || creator.relationships.length === 0).length;
  const signals = buildOverviewSignals({ creators: data.creators, accounts: data.accounts, videos: data.videos });
  const metricCards: OverviewMetric[] = [
    { id: "cpm", label: "Realized CPM", value: formatCpm(data.launchpointAnalytics?.realizedCpm), icon: "cpm" },
    { id: "configuredCpm", label: "Configured CPM", value: formatConfiguredCpm(launchpoint?.configuredCpmMin, launchpoint?.configuredCpmMax), icon: "cpm" },
    { id: "maxCpmEarnable", label: "Max CPM payout", value: formatCpm(launchpoint?.maxCpmEarnable), icon: "cpm" },
    { id: "views", label: "Views", value: formatNumber(totals.views), icon: "eye" },
    { id: "engagement", label: "Engagement", value: formatPercent(totals.engagement), icon: "activity" },
    { id: "likes", label: "Likes", value: formatNumber(totals.likes), icon: "heart" },
    { id: "comments", label: "Comments", value: formatNumber(totals.comments), icon: "comments" },
    { id: "shares", label: "Shares", value: formatNumber(totals.shares), icon: "share" },
    { id: "videos", label: "Posts", value: formatNumber(totals.videos), icon: "video" },
    { id: "bookmarks", label: "Bookmarks", value: formatNumber(totals.bookmarks), icon: "bookmark" },
    { id: "averageViews", label: "Average views", value: formatNumber(totals.views / Math.max(1, totals.videos)), icon: "gauge" },
    { id: "active", label: "Active creators", value: formatNumber(totals.active), icon: "creators" },
    { id: "accounts", label: "Tracked accounts", value: formatNumber(totals.accounts), icon: "accounts" },
    { id: "applicants", label: "Applicants", value: formatNumber(totals.applicants), icon: "applicants" },
    { id: "attention", label: "Needs attention", value: formatNumber(attention), icon: "alert", attention: true },
  ];
  const topAccounts = [...data.accounts].sort((a, b) => b.views - a.views).slice(0, 5);
  const topVideos = [...includedVideos].sort((a, b) => b.views - a.views).slice(0, 5);
  const activityByCreator = new Map(creatorPostActivity(data.creators, data.videos).map((row) => [row.creatorId, row]));
  const creatorActivity = data.creators.map((creator) => ({ creator, activity: activityByCreator.get(creator.id)! }))
    .sort((a, b) => b.activity.postsThisWeek - a.activity.postsThisWeek || b.activity.posts - a.activity.posts || a.creator.displayName.localeCompare(b.creator.displayName));

  const degraded = data.freshness.filter((item) => item.state === "failed" || item.state === "stale");
  return <div className="page-stack">
    <PageTitle title="Result" titleClassName="font-result result-ugc-title" actions={<><OverviewMetricPicker metrics={metricCards} /><CopyOverviewViewButton /></>} />
    {data.sourceMode === "live_provider" ? <div className="source-banner"><Radio /><div><strong>Live Viral data is connected.</strong><span>Creator candidates need confirmation after the shared database is connected; they are not silently treated as signed creators.</span></div><Link href="/integrations">Review setup <ArrowUpRight /></Link></div> : null}
    {degraded.length ? <div className="source-banner source-warning"><AlertTriangle /><div><strong>Showing the last successful snapshot.</strong><span>{degraded.map((item) => `${item.source}: ${item.message ?? item.state}`).join(" · ")}</span></div><Link href="/integrations">View sources <ArrowUpRight /></Link></div> : null}
    <OverviewMetricGrid metrics={metricCards} />
    <section className="dashboard-grid dashboard-main-grid">
      <Card className="panel chart-panel"><div className="panel-header"><h2 className="performance-heading">Performance</h2><div className="range-tabs">{[7, 14, 30].map((days) => {
        const next = new URLSearchParams(preservedView);
        next.set("range", String(days));
        return <Link key={days} href={`/overview?${next.toString()}`} className={range === days ? "active" : ""}>{days}d</Link>;
      })}</div></div><PerformanceChart data={performance} /></Card>
      <article className={`panel ${styles.signalsPanel}`}>
        <div className="panel-header"><div><h2>Signals</h2><p>Unusual movement worth a look</p></div><span className={styles.signalCount}>{signals.length} live</span></div>
        {signals.length ? <div className={styles.signalList}>{signals.map((signal) => {
          const Icon = signal.kind === "breakout" ? TrendingUp : signal.kind === "comments" ? MessageCircleMore : signal.kind === "cadence" ? CalendarClock : ShieldAlert;
          return <Link href={signal.href} className={styles.signalRow} data-kind={signal.kind} key={signal.id}>
            <span className={styles.signalIcon}><Icon /></span>
            <span className={styles.signalCopy}><strong>{signal.title}</strong><small>{signal.detail}</small></span>
            <span className={styles.signalMetric}>{signal.metric}</span>
            <ChevronRight />
          </Link>;
        })}</div> : <div className={styles.signalEmpty}><TrendingUp /><strong>No unusual movement right now</strong><p>Breakouts, comment spikes, cadence gaps, and at-risk accounts will appear here.</p></div>}
      </article>
    </section>
    <section className={styles.directoryGrid}>
      <article className={`panel table-panel ${styles.directoryPanel}`}><div className="panel-header"><h2>Top accounts</h2><Link href="/accounts" className="text-link">View all <ArrowUpRight /></Link></div><div className={`rank-list ${styles.compactRankList}`}>{topAccounts.map((account, index) => <Link href={`/accounts/${encodeURIComponent(account.id)}`} key={account.id}><span className="rank">{String(index + 1).padStart(2, "0")}</span><span className="account-avatar">{account.avatarUrl ? <SourceImage src={account.avatarUrl} width={30} height={30} /> : account.username.slice(0, 1).toUpperCase()}</span><span className="rank-copy"><strong>@{account.username}</strong><small>{account.platform} · {formatNumber(account.followers ?? 0)} followers</small></span><b>{formatNumber(account.views)}</b><TrackingBadge state={account.trackingState} /></Link>)}</div></article>
      <article className={`panel table-panel ${styles.directoryPanel}`}><div className="panel-header"><h2>Top videos</h2><Link href="/videos" className="text-link">View all <ArrowUpRight /></Link></div><div className={`rank-list video-rank-list ${styles.compactRankList} ${styles.videoList}`}>{topVideos.map((video, index) => <Link href={`/videos/${encodeURIComponent(video.id)}`} key={video.id}><span className="rank">{String(index + 1).padStart(2, "0")}</span><span className="video-thumb">{video.thumbnailUrl ? <SourceImage src={video.thumbnailUrl} width={34} height={38} /> : <FileVideo2 />}</span><span className="rank-copy"><strong title={video.caption}>{video.caption}</strong><small>@{video.accountUsername} · {formatPercent(video.engagementRate)}</small></span><b>{formatNumber(video.views)}</b></Link>)}</div></article>
      <article className={`panel table-panel ${styles.directoryPanel} ${styles.creatorPanel}`}><div className="panel-header"><h2>Creators</h2><Link href="/creators" className="text-link">View all <ArrowUpRight /></Link></div><div className={styles.creatorList}>{creatorActivity.map(({ creator, activity }) => {
        const avatarUrl = creator.discord.avatarUrl ?? creator.accounts.find((account) => account.avatarUrl)?.avatarUrl ?? null;
        const handle = creator.discord.username ?? creator.accounts[0]?.username ?? "No account linked";
        const goalRate = activity.goalsTotal ? activity.goalsHit / activity.goalsTotal : 0;
        const goalState = activity.goalsTotal === 0 ? "untracked" : goalRate >= 1 ? "complete" : goalRate >= .7 ? "close" : "behind";
        const goalTitle = activity.goalsTotal
          ? `${activity.goalsHit} of ${activity.goalsTotal} account-day goals hit · 1 post per connected account per day`
          : "No connected account yet, so there is no daily goal to hit";
        return <Link href={`/creators/${encodeURIComponent(creator.id)}`} key={creator.id}>
          <span className={styles.creatorAvatar}>{avatarUrl ? <SourceImage src={avatarUrl} width={32} height={32} /> : creator.displayName.slice(0, 1).toUpperCase()}</span>
          <span className={styles.creatorIdentity}>
            <span className={styles.creatorNameRow}>
              <strong>{creator.displayName}</strong>
              <span className={styles.goalTag} data-state={goalState} title={goalTitle}>{activity.goalsTotal ? `${activity.goalsHit}/${activity.goalsTotal}` : "no goal"}</span>
            </span>
            <small>{handle === "No account linked" ? handle : `@${handle}`} · {activity.posts} posts</small>
          </span>
          <span className={styles.postActivity} aria-label={`${activity.postsThisWeek} posts this Monday-to-Sunday week`}>{activity.activity.map((day) => <span key={day.date} title={`${day.date}: ${day.count} ${day.count === 1 ? "post" : "posts"}`}><small>{day.label}</small><b data-active={day.count > 0}>{day.count}</b></span>)}</span>
          <ChevronRight />
        </Link>;
      })}</div></article>
    </section>
    <section className="freshness-strip">{data.freshness.map((source) => <div key={source.source}><span className={`freshness-dot ${source.state}`} /><span><strong>{source.source}</strong><small>{source.message ?? source.state}</small></span><b>{timeAgo(source.lastSuccessAt)}</b></div>)}</section>
  </div>;
}
