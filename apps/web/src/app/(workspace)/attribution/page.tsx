import { ArrowUpRight, BadgeDollarSign, Link2, MousePointerClick, ShoppingCart, UserCheck } from "lucide-react";
import Link from "next/link";
import { AttributionCharts } from "@/components/attribution-charts";
import { formatNumber, formatPercent, StateBadge, timeAgo } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getPortalData } from "@/lib/portal-data";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(cents / 100);

export default async function AttributionPage() {
  await requireUser();
  const data = await getPortalData();
  const links = data.attribution.links;
  const totals = links.reduce((sum, link) => ({
    clicks: sum.clicks + link.clicks,
    leads: sum.leads + link.leads,
    conversions: sum.conversions + link.conversions,
    sales: sum.sales + link.sales,
    revenue: sum.revenue + link.saleAmount,
  }), { clicks: 0, leads: 0, conversions: 0, sales: 0, revenue: 0 });
  const dubFreshness = data.freshness.find((source) => source.source === "dub");
  const metrics = [
    { label: "Clicks", value: formatNumber(totals.clicks), icon: MousePointerClick },
    { label: "Leads", value: formatNumber(totals.leads), icon: UserCheck },
    { label: "Conversions", value: formatNumber(totals.conversions), icon: ShoppingCart },
    { label: "Sales", value: formatNumber(totals.sales), icon: BadgeDollarSign },
    { label: "Revenue", value: money(totals.revenue), icon: BadgeDollarSign },
    { label: "Click → conversion", value: formatPercent(totals.clicks ? totals.conversions / totals.clicks : 0), icon: ArrowUpRight },
  ];

  return (
    <div className="page-stack attribution-page">
      <header className="page-title"><div><h1>Attribution</h1></div><span className="source-status"><i data-state={dubFreshness?.state ?? "not_configured"} />Dub · {dubFreshness?.lastSuccessAt ? timeAgo(dubFreshness.lastSuccessAt) : "not connected"}</span></header>
      <section className="overview-metric-grid attribution-metrics">
        {metrics.map((metric) => <article className="metric-card overview-metric-card" key={metric.label}><span className="metric-icon"><metric.icon /></span><div className="overview-metric-copy"><p>{metric.label}</p><strong>{metric.value}</strong></div></article>)}
      </section>

      {!links.length ? (
        <section className="panel attribution-empty"><Link2 /><div><h2>No Dub links synchronized</h2><p>{dubFreshness?.message ?? "Add DUB_API_KEY and DUB_DEFAULT_URL to the bot. Active creators will receive one tracking link automatically."}</p></div></section>
      ) : (
        <>
          {data.attribution.series.length ? <AttributionCharts data={data.attribution.series} /> : null}
          <section className="panel attribution-table-panel">
            <div className="panel-header"><h2>Creator links</h2><span>{links.length} allocated</span></div>
            <div className="attribution-table-wrap"><table className="attribution-table"><thead><tr><th>Creator</th><th>Dub link</th><th>Clicks</th><th>Leads</th><th>Conversions</th><th>Sales</th><th>Revenue</th><th>Status</th></tr></thead><tbody>
              {links.sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks).map((link) => <tr key={link.id}>
                <td><Link href={`/creators/${link.creatorId}?tab=attribution`}><strong>{link.creatorName}</strong></Link></td>
                <td><a href={link.shortLink} target="_blank" rel="noreferrer">{link.shortLink}<ArrowUpRight /></a></td>
                <td>{formatNumber(link.clicks)}</td><td>{formatNumber(link.leads)}</td><td>{formatNumber(link.conversions)}</td><td>{formatNumber(link.sales)}</td><td>{money(link.saleAmount)}</td>
                <td><StateBadge label={link.error ? "Sync issue" : link.state} tone={link.error ? "attention" : "success"} /></td>
              </tr>)}
            </tbody></table></div>
          </section>
        </>
      )}
    </div>
  );
}
