import { ArrowLeft, Database, ExternalLink, Hash, Link2, MessageSquareText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatorCharts } from "@/components/creator-charts";
import { VideoTable } from "@/components/data-tables";
import { CandidateActions, CreatorQuickActions, ManualRelationshipButton, NoteButton, type DiscordConnectionCandidate } from "@/components/creator-actions";
import { SourceImage } from "@/components/source-image";
import { formatNumber, formatPercent, StateBadge, timeAgo, TrackingBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getPortalData } from "@/lib/portal-data";
import type { PortalCreator } from "@/lib/portal-types";

const tabs = [
  { id: "accounts", label: "Accounts" },
  { id: "attribution", label: "Attribution" },
  { id: "details", label: "Details" },
  { id: "activity", label: "Activity" },
] as const;

function normalizeTab(tab?: string) {
  if (tab === "activity") return "activity";
  if (tab === "attribution") return "attribution";
  if (tab === "details" || tab === "relationships") return "details";
  return "accounts";
}

function AccountOverview({ creator }: { creator: PortalCreator }) {
  if (!creator.accounts.length) {
    return (
      <div className="empty-state creator-account-empty">
        <Database />
        <strong>No posting accounts connected yet.</strong>
        <p>Accounts discovered through Launchpoint or Viral will appear here for confirmation.</p>
      </div>
    );
  }

  return (
    <div className="creator-account-list">
      {creator.accounts.map((account) => (
        <Link href={`/accounts/${encodeURIComponent(account.id)}`} key={account.id} className="creator-account-row">
          <span className="account-avatar creator-account-avatar">
            {account.avatarUrl ? <SourceImage src={account.avatarUrl} width={42} height={42} /> : account.username.slice(0, 1)}
          </span>
          <span className="creator-account-copy">
            <strong>@{account.username}</strong>
            <small>{account.platform}{account.displayName && account.displayName !== account.username ? ` · ${account.displayName}` : ""}</small>
          </span>
          <span className="creator-account-stat"><small>Followers</small><strong>{formatNumber(account.followers ?? 0)}</strong></span>
          <span className="creator-account-stat"><small>Posts</small><strong>{formatNumber(account.posts)}</strong></span>
          <span className="creator-account-stat"><small>Views</small><strong>{formatNumber(account.views)}</strong></span>
          <span className="creator-account-stat"><small>Engagement</small><strong>{formatPercent(account.engagementRate)}</strong></span>
          <span className="creator-account-status">
            <StateBadge label={account.linkState} tone={account.linkState === "confirmed" ? "success" : "attention"} />
            <TrackingBadge state={account.trackingState} />
          </span>
          <ExternalLink className="creator-account-open" />
        </Link>
      ))}
    </div>
  );
}

export default async function CreatorProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireUser();
  const [{ id }, query, data] = await Promise.all([params, searchParams, getPortalData()]);
  const creator = data.creators.find((item) => item.id === id);
  if (!creator) notFound();

  const tab = normalizeTab(query.tab);
  const videos = data.videos.filter((video) => creator.accounts.some((account) => account.id === video.accountId));
  const creatorActivities = data.activities.filter((event) => event.creatorId === creator.id);
  const attributionLink = data.attribution.links.find((link) => link.creatorId === creator.id);
  const confirmedAccounts = creator.accounts.filter((account) => account.linkState === "confirmed").length;
  const discordCandidates: DiscordConnectionCandidate[] = data.creators.filter((candidate) => candidate.id !== creator.id && candidate.discord.userId && !candidate.accounts.length && !candidate.relationships.length && !candidate.notes.length).map((candidate) => ({ creatorId: candidate.id, userId: candidate.discord.userId!, username: candidate.discord.username, displayName: candidate.discord.displayName ?? candidate.displayName, state: candidate.discord.state }));

  return (
    <div className="page-stack creator-profile">
      <Link href="/creators" className="back-link"><ArrowLeft /> All creators</Link>

      <header className="profile-header">
        <div className="profile-identity">
          <span className="profile-avatar">
            {creator.accounts[0]?.avatarUrl ? <SourceImage src={creator.accounts[0].avatarUrl} width={56} height={56} /> : creator.displayName.slice(0, 1)}
          </span>
          <div>
            <div className="badge-row">
              <StateBadge label={creator.lifecycle} tone={creator.lifecycle === "active" ? "success" : "attention"} />
              <StateBadge label={creator.discord.state} tone={creator.discord.state === "connected" ? "success" : "neutral"} />
              {creator.relationships.map((relationship) => (
                <StateBadge key={relationship.id} label={relationship.provider} tone={relationship.state === "signed_active" ? "success" : "neutral"} />
              ))}
            </div>
            <h1>{creator.displayName}</h1>
            <p>{creator.source === "viral_candidate" ? "Account match awaiting confirmation" : creator.discord.username ? `@${creator.discord.username} on Discord` : creator.email ?? "Result creator"}</p>
          </div>
        </div>
        <div className="profile-actions">
          {creator.source === "viral_candidate" && creator.accounts[0] ? (
            <CandidateActions accountId={creator.accounts[0].id} />
          ) : (
            <>
              <NoteButton creatorId={creator.id} />
              <CreatorQuickActions creatorId={creator.id} discordState={creator.discord.state} discordUserId={creator.discord.userId} candidates={discordCandidates} />
            </>
          )}
        </div>
      </header>

      <nav className="profile-tabs">
        {tabs.map((item) => (
          <Link className={tab === item.id ? "active" : ""} href={`/creators/${id}?tab=${item.id}`} key={item.id}>{item.label}</Link>
        ))}
      </nav>

      {tab === "accounts" ? (
        <div className="page-stack creator-accounts-page">
          <CreatorCharts creator={creator} videos={data.videos} />
          <section className="panel creator-accounts-panel">
            <div className="panel-header">
              <div><h2>Accounts</h2><p>{confirmedAccounts} confirmed · {creator.accounts.length} total</p></div>
            </div>
            <AccountOverview creator={creator} />
          </section>

          <section className="metric-grid creator-summary-metrics">
            {[
              { label: "Posts in 30 days", value: formatNumber(creator.posts30d) },
              { label: "Views in 30 days", value: formatNumber(creator.views30d) },
              { label: "Engagement", value: formatPercent(creator.engagementRate) },
            ].map((metric) => (
              <article className="metric-card" key={metric.label}><div><p>{metric.label}</p><strong>{metric.value}</strong></div></article>
            ))}
          </section>

          <section>
            <div className="section-heading-simple">
              <div><h2>Videos</h2><p>Content from this creator’s connected accounts</p></div>
              <span>{videos.length} videos</span>
            </div>
            <VideoTable videos={videos} />
          </section>
        </div>
      ) : null}

      {tab === "attribution" ? (
        attributionLink ? (
          <div className="page-stack creator-attribution-tab">
            <section className="overview-metric-grid attribution-metrics">
              {[
                ["Clicks", formatNumber(attributionLink.clicks)],
                ["Leads", formatNumber(attributionLink.leads)],
                ["Conversions", formatNumber(attributionLink.conversions)],
                ["Sales", formatNumber(attributionLink.sales)],
                ["Revenue", new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(attributionLink.saleAmount / 100)],
              ].map(([label, value]) => <article className="metric-card overview-metric-card" key={label}><div className="overview-metric-copy"><p>{label}</p><strong>{value}</strong></div></article>)}
            </section>
            <section className="panel creator-attribution-link">
              <div><Link2 /><span><small>Dub link</small><strong>{attributionLink.shortLink}</strong></span></div>
              <a href={attributionLink.shortLink} target="_blank" rel="noreferrer">Open link <ExternalLink /></a>
            </section>
          </div>
        ) : (
          <div className="empty-state creator-account-empty"><Link2 /><strong>No Dub link allocated yet.</strong><p>The bot provisions one automatically after Dub is configured and this creator has an active Discord identity.</p></div>
        )
      ) : null}

      {tab === "details" ? (
        <div className="creator-details-layout">
          <div className="profile-main">
            <section className="panel">
              <div className="panel-header"><div><h2>Creator details</h2><p>What the team needs to know and do next</p></div></div>
              <dl className="details-grid">
                <div><dt>Manager</dt><dd>{creator.managerName ?? "Unassigned"}</dd></div>
                <div><dt>Status</dt><dd>{creator.lifecycle}</dd></div>
                <div className="wide"><dt>Next step</dt><dd>{creator.nextStep ?? "No next step"}</dd></div>
                <div><dt>Attention</dt><dd>{creator.attentionState ?? "No exception"}</dd></div>
                <div><dt>Last activity</dt><dd>{timeAgo(creator.lastActivityAt)}</dd></div>
              </dl>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div><h2>Internal notes</h2><p>Shared context for this creator</p></div>
                {creator.source === "result" ? <NoteButton creatorId={creator.id} /> : null}
              </div>
              {creator.notes.length ? (
                <div className="notes-list">
                  {creator.notes.map((note) => <article key={note.id}><p>{note.body}</p><span>{note.author ?? "Result team"} · {timeAgo(note.createdAt)}</span></article>)}
                </div>
              ) : (
                <div className="empty-state small"><MessageSquareText /><strong>No internal notes yet.</strong><p>Add context the team should know about this creator.</p></div>
              )}
            </section>
          </div>

          <aside className="profile-aside">
            <section className="panel">
              <div className="panel-header"><div><h2>Discord</h2><p>Current server access</p></div></div>
              <div className="connected-system-row">
                <span className="large-icon"><Hash /></span>
                <span><strong>{creator.discord.displayName ?? "Not connected"}</strong><small>{creator.discord.username ? `@${creator.discord.username}` : "No Discord member linked"}</small></span>
                <StateBadge label={creator.discord.state} tone={creator.discord.state === "connected" ? "success" : "attention"} />
              </div>
              {creator.discord.channelId ? (
                <a className="panel-footer-link" href={`https://discord.com/channels/${creator.discord.guildId}/${creator.discord.channelId}`} target="_blank" rel="noreferrer">Open private channel <ExternalLink /></a>
              ) : (
                <div className="panel-footer-action"><CreatorQuickActions creatorId={creator.id} discordState={creator.discord.state} discordUserId={creator.discord.userId} candidates={discordCandidates} /></div>
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <div><h2>Signing</h2><p>Launchpoint, SideShift, or another provider</p></div>
                <ManualRelationshipButton creatorId={creator.id} />
              </div>
              {creator.relationships.length ? creator.relationships.map((relationship) => (
                <div className="connected-system-row" key={relationship.id}>
                  <span className="large-icon"><ShieldCheck /></span>
                  <span><strong>{relationship.provider}</strong><small>{relationship.program ?? (relationship.syncMode === "api" ? "Automatically synced" : "Manually verified")}</small></span>
                  <StateBadge label={relationship.state} tone={relationship.state === "signed_active" ? "success" : "neutral"} />
                  {relationship.sourceUrl ? <a href={relationship.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${relationship.provider}`}><ExternalLink /></a> : null}
                </div>
              )) : (
                <div className="empty-state small"><ShieldCheck /><strong>No signing relationship yet.</strong><p>Add a manual relationship or connect Launchpoint synchronization.</p></div>
              )}
            </section>
          </aside>
        </div>
      ) : null}

      {tab === "activity" ? (
        <section className="panel">
          <div className="panel-header"><div><h2>Activity</h2><p>Notes, access changes, account links, and provider updates</p></div></div>
          {creatorActivities.length ? (
            <div className="notes-list">
              {creatorActivities.map((event) => <article key={event.id}><p>{event.summary}</p><span>{event.actor ?? "System"} · {timeAgo(event.occurredAt)}</span></article>)}
            </div>
          ) : (
            <div className="empty-state"><Database /><strong>No activity yet.</strong><p>Changes to this creator will appear here.</p></div>
          )}
        </section>
      ) : null}
    </div>
  );
}
