"use client";

import { useMemo, useState } from "react";
import { Area, Line } from "@/components/dither-kit/area";
import { AreaChart, LineChart } from "@/components/dither-kit/area-chart";
import { Bar } from "@/components/dither-kit/bar";
import { BarChart } from "@/components/dither-kit/bar-chart";
import { Grid } from "@/components/dither-kit/grid";
import { ReferenceLine } from "@/components/dither-kit/reference-line";
import { Tooltip } from "@/components/dither-kit/tooltip";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";
import { seedOfColor, type DitherColor } from "@/components/dither-kit/palette";
import { creatorAccountTotals, creatorBaselineViews, creatorDailySeries, creatorRecentPosts, creatorWeeklySeries, foldAccountTail } from "@/lib/creator-series";
import type { PortalCreator, PortalVideo } from "@/lib/portal-types";
import { formatNumber } from "./ui";

const chartMargins = { top: 12, right: 16, bottom: 26, left: 46 };


function shortDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * One chart, one question, one y-axis. Each series is alone in its frame, so
 * the heading carries identity and no legend is needed.
 */
function ChartFrame({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <section className="creator-chart-card">
      <header><strong>{title}</strong><small>{caption}</small></header>
      <div className="creator-chart-canvas">{children}</div>
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <div className="creator-chart-empty"><span>{message}</span></div>;
}

function config(key: string, label: string, color: DitherColor) {
  return { [key]: { label, color } };
}

export function CreatorCharts({ creator, videos, days = 30 }: { creator: PortalCreator; videos: PortalVideo[]; days?: number }) {
  const [interval, setInterval] = useState<"daily" | "weekly">("daily");
  const daily = useMemo(() => creatorDailySeries(creator, videos, days), [creator, videos, days]);
  const weekly = useMemo(() => creatorWeeklySeries(creator, videos, 12), [creator, videos]);
  const recent = useMemo(() => creatorRecentPosts(creator, videos, 12), [creator, videos]);
  const accounts = useMemo(() => foldAccountTail(creatorAccountTotals(creator, videos)), [creator, videos]);
  const baseline = useMemo(() => creatorBaselineViews(creator, videos), [creator, videos]);
  const performance = interval === "weekly" ? weekly : daily;
  const labelKey = interval === "weekly" ? "label" : "date";
  const tickFormatter = interval === "weekly" ? (value: unknown) => String(value) : (value: unknown) => shortDate(String(value));
  const windowCaption = interval === "weekly" ? "Monday–Sunday · last 12 weeks" : `Last ${days} days`;

  const hasReach = performance.some((row) => row.views > 0);
  const hasPosts = performance.some((row) => row.posts > 0);
  const hasEngagement = performance.some((row) => row.engagementRate > 0);

  return (
    <section className="creator-performance-section">
      <header className="creator-performance-header">
        <div><h2>Performance</h2><p>Counted content across this creator’s connected accounts</p></div>
        <div className="creator-performance-toggle" role="group" aria-label="Performance interval">
          <button type="button" className={interval === "daily" ? "active" : ""} aria-pressed={interval === "daily"} onClick={() => setInterval("daily")}>Daily</button>
          <button type="button" className={interval === "weekly" ? "active" : ""} aria-pressed={interval === "weekly"} onClick={() => setInterval("weekly")}>Weekly</button>
        </div>
      </header>
      <div className="creator-chart-grid">
        <ChartFrame title="Views" caption={`Counted views · ${windowCaption}`}>
        {hasReach ? (
          <AreaChart data={performance} config={config("views", "Views", "blue")} bloom="aura" margins={chartMargins}>
            <Grid />
            <XAxis dataKey={labelKey} maxTicks={5} tickFormatter={tickFormatter} />
            <YAxis tickFormatter={formatNumber} />
            <Tooltip labelKey={labelKey} itemsAt={(index) => [{ name: "views", label: "Views", value: performance[index]?.views ?? 0, seed: seedOfColor("blue"), dimmed: false }]} variant="frosted-glass" valueFormatter={(value) => formatNumber(value)} />
            <Area dataKey="views" variant="gradient" />
          </AreaChart>
        ) : <EmptyChart message="No counted views in this window." />}
        </ChartFrame>

        <ChartFrame title="Posting cadence" caption={`Counted posts · ${windowCaption}`}>
        {hasPosts ? (
          <BarChart data={performance} config={config("posts", "Posts", "purple")} bloom="low" margins={chartMargins}>
            <Grid />
            <XAxis dataKey={labelKey} maxTicks={5} tickFormatter={tickFormatter} />
            <YAxis tickFormatter={(value) => String(Math.round(value))} />
            <Tooltip labelKey={labelKey} itemsAt={(index) => [{ name: "posts", label: "Posts", value: performance[index]?.posts ?? 0, seed: seedOfColor("purple"), dimmed: false }]} variant="frosted-glass" valueFormatter={(value) => String(Math.round(value))} />
            <Bar dataKey="posts" variant="hatched" />
          </BarChart>
        ) : <EmptyChart message="No counted posts in this window." />}
        </ChartFrame>

        <ChartFrame title="Posts against baseline" caption={`Last ${recent.length} posts · median is ${formatNumber(baseline)} views`}>
        {recent.length ? (
          <BarChart data={recent} config={config("views", "Views", "green")} bloom="low" margins={chartMargins}>
            <Grid />
            <XAxis dataKey="label" maxTicks={4} tickFormatter={(value) => String(value).slice(0, 12)} />
            <YAxis tickFormatter={formatNumber} />
            <ReferenceLine y={baseline} label={`baseline ${formatNumber(baseline)}`} />
            <Tooltip labelKey="label" itemsAt={(index) => [{ name: "views", label: `Views (${(recent[index]?.multiplier ?? 0).toFixed(1)}× baseline)`, value: recent[index]?.views ?? 0, seed: seedOfColor("green"), dimmed: false }]} variant="frosted-glass" valueFormatter={(value) => formatNumber(value)} />
            <Bar dataKey="views" variant="dotted" />
          </BarChart>
        ) : <EmptyChart message="No counted posts yet." />}
        </ChartFrame>

        <ChartFrame title="Engagement rate" caption={`Engagements per 100 views · ${windowCaption}`}>
        {hasEngagement ? (
          <LineChart data={performance} config={config("engagementRate", "Engagement", "pink")} bloom="aura" margins={chartMargins}>
            <Grid />
            <XAxis dataKey={labelKey} maxTicks={5} tickFormatter={tickFormatter} />
            <YAxis tickFormatter={(value) => `${value.toFixed(1)}%`} />
            <Tooltip labelKey={labelKey} itemsAt={(index) => [{ name: "engagementRate", label: "Engagement", value: performance[index]?.engagementRate ?? 0, seed: seedOfColor("pink"), dimmed: false }]} variant="frosted-glass" valueFormatter={(value) => `${value.toFixed(2)}%`} />
            <Line dataKey="engagementRate" />
          </LineChart>
        ) : <EmptyChart message="No engagement recorded in this window." />}
        </ChartFrame>

        <ChartFrame title="Where the reach comes from" caption="Counted views by posting account">
        {accounts.length ? (
          <BarChart data={accounts} config={config("views", "Views", "orange")} bloom="low" margins={chartMargins}>
            <Grid />
            <XAxis dataKey="account" maxTicks={6} />
            <YAxis tickFormatter={formatNumber} />
            <Tooltip labelKey="account" itemsAt={(index) => [{ name: "views", label: `Views · ${accounts[index]?.posts ?? 0} posts`, value: accounts[index]?.views ?? 0, seed: seedOfColor("orange"), dimmed: false }]} variant="frosted-glass" valueFormatter={(value) => formatNumber(value)} />
            <Bar dataKey="views" variant="hatched" />
          </BarChart>
        ) : <EmptyChart message="No counted posts on any account." />}
        </ChartFrame>
      </div>
    </section>
  );
}
