"use client";

import { useMemo } from "react";
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
import { creatorAccountTotals, creatorBaselineViews, creatorDailySeries, creatorRecentPosts, foldAccountTail } from "@/lib/creator-series";
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
  const daily = useMemo(() => creatorDailySeries(creator, videos, days), [creator, videos, days]);
  const recent = useMemo(() => creatorRecentPosts(creator, videos, 12), [creator, videos]);
  const accounts = useMemo(() => foldAccountTail(creatorAccountTotals(creator, videos)), [creator, videos]);
  const baseline = useMemo(() => creatorBaselineViews(creator, videos), [creator, videos]);

  const hasReach = daily.some((row) => row.views > 0);
  const hasPosts = daily.some((row) => row.posts > 0);
  const hasEngagement = daily.some((row) => row.engagementRate > 0);

  return (
    <div className="creator-chart-grid">
      <ChartFrame title="Views" caption={`Counted views per day · last ${days} days`}>
        {hasReach ? (
          <AreaChart data={daily} config={config("views", "Views", "blue")} bloom="aura" margins={chartMargins}>
            <Grid />
            <XAxis dataKey="date" maxTicks={5} tickFormatter={(value) => shortDate(String(value))} />
            <YAxis tickFormatter={formatNumber} />
            <Tooltip labelKey="date" itemsAt={(index) => [{ name: "views", label: "Views", value: daily[index]?.views ?? 0, seed: seedOfColor("blue"), dimmed: false }]} variant="frosted-glass" valueFormatter={(value) => formatNumber(value)} />
            <Area dataKey="views" variant="gradient" />
          </AreaChart>
        ) : <EmptyChart message="No counted views in this window." />}
      </ChartFrame>

      <ChartFrame title="Posting cadence" caption={`Counted posts per day · last ${days} days`}>
        {hasPosts ? (
          <BarChart data={daily} config={config("posts", "Posts", "purple")} bloom="low" margins={chartMargins}>
            <Grid />
            <XAxis dataKey="date" maxTicks={5} tickFormatter={(value) => shortDate(String(value))} />
            <YAxis tickFormatter={(value) => String(Math.round(value))} />
            <Tooltip labelKey="date" itemsAt={(index) => [{ name: "posts", label: "Posts", value: daily[index]?.posts ?? 0, seed: seedOfColor("purple"), dimmed: false }]} variant="frosted-glass" valueFormatter={(value) => String(Math.round(value))} />
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

      <ChartFrame title="Engagement rate" caption={`Engagements per 100 views · last ${days} days`}>
        {hasEngagement ? (
          <LineChart data={daily} config={config("engagementRate", "Engagement", "pink")} bloom="aura" margins={chartMargins}>
            <Grid />
            <XAxis dataKey="date" maxTicks={5} tickFormatter={(value) => shortDate(String(value))} />
            <YAxis tickFormatter={(value) => `${value.toFixed(1)}%`} />
            <Tooltip labelKey="date" itemsAt={(index) => [{ name: "engagementRate", label: "Engagement", value: daily[index]?.engagementRate ?? 0, seed: seedOfColor("pink"), dimmed: false }]} variant="frosted-glass" valueFormatter={(value) => `${value.toFixed(2)}%`} />
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
  );
}
