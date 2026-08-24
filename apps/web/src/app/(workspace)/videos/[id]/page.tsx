import { ArrowLeft, ExternalLink, FileVideo2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatNumber, formatPercent, StateBadge, timeAgo, TrackingBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getPortalData } from "@/lib/portal-data";

export default async function VideoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const [{ id }, data] = await Promise.all([params, getPortalData()]);
  const video = data.videos.find((item) => item.id === id);
  if (!video) notFound();
  const account = data.accounts.find((item) => item.id === video.accountId) ?? null;
  const creator = video.creatorId ? data.creators.find((item) => item.id === video.creatorId && item.source === "result") ?? null : null;
  return <div className="page-stack creator-profile">
    <Link href="/videos" className="back-link"><ArrowLeft /> All videos</Link>
    <header className="profile-header"><div className="profile-identity"><span className="profile-avatar">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" /> : <FileVideo2 />}</span><div><div className="badge-row"><StateBadge label={video.platform} tone="info" /><StateBadge label={video.included ? "included" : "excluded"} tone={video.included ? "success" : "neutral"} /><TrackingBadge state={video.trackingState} /></div><h1>{video.caption}</h1><p>@{video.accountUsername} · {formatDate(video.publishedAt)}</p></div></div><div className="profile-actions">{video.sourceUrl ? <a className="primary-button" href={video.sourceUrl} target="_blank" rel="noreferrer">Watch original <ExternalLink /></a> : null}</div></header>
    <section className="metric-grid profile-metrics">{[
      { label: "Views", value: video.views }, { label: "Likes", value: video.likes }, { label: "Comments", value: video.comments }, { label: "Shares", value: video.shares }, { label: "Saves", value: video.bookmarks }, { label: "Engagement", value: formatPercent(video.engagementRate) },
    ].map((metric) => <article className="metric-card" key={metric.label}><div><p>{metric.label}</p><strong>{typeof metric.value === "number" ? formatNumber(metric.value) : metric.value}</strong></div></article>)}</section>
    <div className="profile-grid"><section className="panel"><div className="panel-header"><div><h2>Content record</h2><p>Last successful provider snapshot</p></div></div><dl className="details-grid"><div><dt>Published</dt><dd>{formatDate(video.publishedAt)}</dd></div><div><dt>Duration</dt><dd>{video.durationSeconds == null ? "—" : `${video.durationSeconds}s`}</dd></div><div><dt>Baseline</dt><dd>{video.baselineMultiplier.toFixed(1)}×</dd></div><div><dt>Last refresh</dt><dd>{timeAgo(video.refreshedAt)}</dd></div><div className="wide"><dt>Platform video ID</dt><dd>{video.platformVideoId}</dd></div>{video.error ? <div className="wide"><dt>Provider error</dt><dd>{video.error}</dd></div> : null}</dl></section><aside className="profile-aside"><section className="panel"><div className="panel-header"><div><h2>Ownership</h2><p>Canonical Result graph</p></div></div><div className="integration-card-body">{account ? <><strong>@{account.username}</strong><p>{account.platform} account</p><Link href={`/accounts/${encodeURIComponent(account.id)}`} className="secondary-button">Open account</Link></> : null}{creator ? <><strong>{creator.displayName}</strong><p>{creator.discord.username ? `Discord @${creator.discord.username}` : "Discord pending"}</p><Link href={`/creators/${creator.id}?tab=content`} className="secondary-button">Open Creator 360</Link></> : <p>No canonical creator has been confirmed for this video’s account.</p>}</div></section></aside></div>
  </div>;
}
