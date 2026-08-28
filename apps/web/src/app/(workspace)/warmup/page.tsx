import { ArrowUpRight, CalendarClock, CheckCircle2, Flame, TimerReset, UsersRound } from "lucide-react";
import Link from "next/link";
import { SourceImage } from "@/components/source-image";
import { Card } from "@/components/ui/card";
import { formatDate, PageTitle, StateBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getPortalData } from "@/lib/portal-data";
import { creatorsInWarmup, warmupSummary } from "@/lib/warmup";

export default async function WarmupPage() {
  await requireUser();
  const data = await getPortalData();
  const warmups = creatorsInWarmup(data.creators);
  const summary = warmupSummary(warmups);

  return <div className="page-stack warmup-page">
    <PageTitle eyebrow="CREATOR OPERATIONS" title="Warmup" />

    <section className="metric-grid warmup-summary-grid" aria-label="Warmup summary">
      <Card className="metric-card"><span className="metric-icon"><UsersRound /></span><div><p>Creators warming up</p><strong>{summary.active}</strong><span>Active countdowns</span></div></Card>
      <Card className={`metric-card ${summary.endingSoon ? "metric-attention" : ""}`}><span className="metric-icon"><CalendarClock /></span><div><p>Ending tomorrow</p><strong>{summary.endingSoon}</strong><span>One day remaining</span></div></Card>
      <Card className="metric-card"><span className="metric-icon"><TimerReset /></span><div><p>Average remaining</p><strong>{summary.averageDaysLeft}d</strong><span>Across active warmups</span></div></Card>
    </section>

    <section className="panel warmup-panel">
      <div className="panel-header"><div><h2>Active creator warmups</h2><p>Synced from Result Clanker</p></div><StateBadge label={`${warmups.length} active`} tone={warmups.length ? "info" : "success"} /></div>
      {warmups.length ? <div className="warmup-list">
        {warmups.map((creator) => {
          const warmup = creator.warmup!;
          const avatarUrl = creator.discord.avatarUrl ?? creator.accounts.find((account) => account.avatarUrl)?.avatarUrl ?? null;
          const progress = Math.max(0, Math.min(100, ((warmup.durationDays - warmup.daysLeft) / warmup.durationDays) * 100));
          return <Link href={`/creators/${creator.id}`} className="warmup-row" key={creator.id}>
            <span className="warmup-avatar">{avatarUrl ? <SourceImage src={avatarUrl} width={38} height={38} /> : creator.displayName.slice(0, 1).toUpperCase()}</span>
            <span className="warmup-identity"><strong>{creator.displayName}</strong><small>{creator.discord.username ? `@${creator.discord.username}` : "Discord identity unavailable"}</small></span>
            <span className="warmup-countdown"><strong>{warmup.daysLeft}</strong><small>day{warmup.daysLeft === 1 ? "" : "s"} left</small></span>
            <span className="warmup-window"><small>{formatDate(warmup.startedAt)} → {formatDate(warmup.endsAt)}</small><span aria-label={`${Math.round(progress)}% of warmup elapsed`}><i style={{ width: `${progress}%` }} /></span></span>
            <ArrowUpRight />
          </Link>;
        })}
      </div> : <div className="empty-state small"><CheckCircle2 /><strong>No creators are currently in warmup</strong><p>Start one with /warmup in the creator&apos;s private Discord channel.</p></div>}
    </section>

    <div className="source-banner compact warmup-source"><Flame /><div><strong>Discord is the control surface.</strong><span>Use /warmup-details for the same live roster in Result Clanker.</span></div></div>
  </div>;
}
