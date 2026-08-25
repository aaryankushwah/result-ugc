import { Activity, Radio } from "lucide-react";
import Link from "next/link";
import { PageTitle, timeAgo } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getPortalData } from "@/lib/portal-data";

const EVENTS_PER_PAGE = 40;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUser();
  const [data, query] = await Promise.all([getPortalData(), searchParams]);
  const pageCount = Math.max(1, Math.ceil(data.activities.length / EVENTS_PER_PAGE));
  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1;
  const pageActivities = data.activities.slice((page - 1) * EVENTS_PER_PAGE, page * EVENTS_PER_PAGE);

  return <div className="page-stack">
    <PageTitle eyebrow="AUDIT LOG" title="Activity" />
    <section className="freshness-strip large">{data.freshness.map((source) => <div key={source.source}><span className={`freshness-dot ${source.state}`} /><span><strong>{source.source}</strong><small>{source.message ?? source.state}</small></span><b>{timeAgo(source.lastSuccessAt)}</b></div>)}</section>
    <section className="panel">
      <div className="panel-header"><h2>Timeline</h2><span>{data.activities.length} events</span></div>
      {pageActivities.length ? pageActivities.map((event) => <div className="activity-row" key={event.id}><span><Radio /></span><div><strong>{event.summary}</strong><p>{event.creatorName ?? "Organization"} · {event.actor ?? "System"}</p></div><time>{timeAgo(event.occurredAt)}</time></div>) : <div className="empty-state"><Activity /><strong>No Result audit events yet.</strong></div>}
      {pageCount > 1 ? <nav className="activity-pagination" aria-label="Activity pages"><Link aria-disabled={page === 1} href={page > 2 ? `/activity?page=${page - 1}` : "/activity"}>Previous</Link><span>Page {page} of {pageCount}</span><Link aria-disabled={page === pageCount} href={`/activity?page=${Math.min(page + 1, pageCount)}`}>Next</Link></nav> : null}
    </section>
  </div>;
}
