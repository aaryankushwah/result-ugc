"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Check, Plus, X } from "lucide-react";
import { AreaChart } from "@/components/dither-kit/area-chart";
import { Area } from "@/components/dither-kit/area";
import { BarChart } from "@/components/dither-kit/bar-chart";
import { Bar } from "@/components/dither-kit/bar";
import { Grid } from "@/components/dither-kit/grid";
import { Tooltip } from "@/components/dither-kit/tooltip";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";
import type { DitherColor } from "@/components/dither-kit/palette";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { PerformancePoint } from "@/lib/portal-types";
import { formatNumber } from "./ui";

type MetricKey = Exclude<keyof PerformancePoint, "date">;
type MetricDefinition = { label: string; color: DitherColor; cssColor: string; axis: "left" | "right"; mark: "area" | "bar" | "line"; dashed?: boolean };

const metrics: Record<MetricKey, MetricDefinition> = {
  views: { label: "Views", color: "purple", cssColor: "#8b6ff0", axis: "left", mark: "area" },
  posts: { label: "Posted videos", color: "orange", cssColor: "#ff7043", axis: "right", mark: "bar" },
  activeAccounts: { label: "Active accounts", color: "grey", cssColor: "#9a9a9a", axis: "right", mark: "bar" },
  likes: { label: "Likes", color: "pink", cssColor: "#e45f9e", axis: "left", mark: "line" },
  comments: { label: "Comments", color: "blue", cssColor: "#4b9fe8", axis: "left", mark: "line", dashed: true },
  shares: { label: "Shares", color: "purple", cssColor: "#b46ee3", axis: "left", mark: "line", dashed: true },
  bookmarks: { label: "Bookmarks", color: "orange", cssColor: "#de9146", axis: "left", mark: "line", dashed: true },
  engagementRate: { label: "Engagement rate", color: "green", cssColor: "#63b36d", axis: "right", mark: "bar" },
};

const metricGroups: Array<{ label: string; keys: MetricKey[] }> = [
  { label: "Account metrics", keys: ["activeAccounts"] },
  { label: "Video metrics", keys: ["views", "posts", "likes", "comments", "shares", "bookmarks", "engagementRate"] },
];

const metricValue = (key: MetricKey, value: number) => key === "engagementRate" ? `${value.toFixed(1)}%` : formatNumber(value);
const shortDate = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric" });

export function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  const [selected, setSelected] = useState<MetricKey[]>(["views", "posts"]);
  const chartData = useMemo(() => data.map((point) => ({ ...point, engagementRate: point.engagementRate * 100 })), [data]);
  const selectedSet = new Set(selected);
  const leftKeys = selected.filter((key) => metrics[key].axis === "left");
  const rightKeys = selected.filter((key) => metrics[key].axis === "right");
  const rightIsPercentOnly = rightKeys.length > 0 && rightKeys.every((key) => key === "engagementRate");
  const leftConfig = Object.fromEntries(leftKeys.map((key) => [key, { label: metrics[key].label, color: metrics[key].color }]));
  const rightConfig = Object.fromEntries(rightKeys.map((key) => [key, { label: metrics[key].label, color: metrics[key].color }]));
  const add = (key: MetricKey) => setSelected((current) => current.includes(key) ? current : [...current, key].slice(-4));
  const remove = (key: MetricKey) => setSelected((current) => current.length === 1 ? current : current.filter((item) => item !== key));

  return <div className="performance-chart-shell">
    <div className="performance-chart-toolbar">
      <div className="performance-metric-chips">
        {selected.map((key) => <span className="performance-metric-chip" key={key} style={{ "--metric-color": metrics[key].cssColor } as CSSProperties}>
          <i />{metrics[key].label}
          <button type="button" aria-label={`Remove ${metrics[key].label}`} disabled={selected.length === 1} onClick={() => remove(key)}><X /></button>
        </span>)}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="performance-add-metric"><Plus /> Add metric</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="performance-metric-menu">
            {metricGroups.map((group, index) => <div key={group.label}>
              {index > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
              {group.keys.map((key) => <DropdownMenuItem key={key} disabled={selectedSet.has(key)} onSelect={() => add(key)}>
                <i className="performance-menu-dot" style={{ background: metrics[key].cssColor }} />
                {metrics[key].label}
                {selectedSet.has(key) ? <Check className="performance-menu-check" /> : null}
              </DropdownMenuItem>)}
            </div>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    <div className="performance-chart-canvas">
      {rightKeys.length ? <div className="performance-chart-layer performance-chart-bars">
        <BarChart data={chartData} config={rightConfig} bloom="low" interactive={leftKeys.length === 0} margins={{ top: 12, right: 46, bottom: 30, left: 54 }}>
          <Grid />
          <XAxis dataKey="date" maxTicks={7} tickFormatter={(value) => shortDate(String(value))} />
          <YAxis orientation="right" tickFormatter={(value) => rightIsPercentOnly ? `${value.toFixed(0)}%` : formatNumber(value)} />
          {!leftKeys.length ? <Tooltip labelKey="date" variant="frosted-glass" valueFormatter={(value, name) => metricValue(name as MetricKey, value)} /> : null}
          {rightKeys.map((key, index) => <Bar key={key} dataKey={key} variant={index % 2 ? "dotted" : "hatched"} />)}
        </BarChart>
      </div> : null}
      {leftKeys.length ? <div className="performance-chart-layer performance-chart-lines">
        <AreaChart data={chartData} config={leftConfig} bloom="aura" margins={{ top: 12, right: 46, bottom: 30, left: 54 }}>
          {!rightKeys.length ? <><Grid /><XAxis dataKey="date" maxTicks={7} tickFormatter={(value) => shortDate(String(value))} /></> : null}
          <YAxis tickFormatter={formatNumber} />
          <Tooltip labelKey="date" variant="frosted-glass" valueFormatter={(value, name) => metricValue(name as MetricKey, value)} />
          {leftKeys.map((key, index) => <Area key={key} dataKey={key} variant={index === 0 ? "gradient" : index % 2 ? "dotted" : "hatched"} strokeVariant={metrics[key].dashed ? "dashed" : "solid"} />)}
        </AreaChart>
      </div> : null}
    </div>
  </div>;
}
