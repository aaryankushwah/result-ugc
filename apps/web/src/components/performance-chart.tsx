"use client";

import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Check, ChevronLeft, ChevronRight, GripVertical, Plus, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AreaChart } from "@/components/dither-kit/area-chart";
import { Area } from "@/components/dither-kit/area";
import { BarChart } from "@/components/dither-kit/bar-chart";
import { Bar } from "@/components/dither-kit/bar";
import { Grid } from "@/components/dither-kit/grid";
import { Tooltip } from "@/components/dither-kit/tooltip";
import type { TooltipItem } from "@/components/dither-kit/common-context";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";
import { seedOfColor, type DitherColor } from "@/components/dither-kit/palette";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { PerformancePoint } from "@/lib/portal-types";
import { moveItem } from "@/lib/reorder";
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
const defaultMetricKeys: MetricKey[] = ["views", "posts"];

function readMetricKeys(value: string | null): MetricKey[] {
  if (!value) return defaultMetricKeys;
  const allowed = new Set(Object.keys(metrics) as MetricKey[]);
  const selected = [...new Set(value.split(",").filter((key): key is MetricKey => allowed.has(key as MetricKey)))];
  return selected.length ? selected.slice(0, 4) : defaultMetricKeys;
}

export function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const seriesParam = params.get("series");
  const [selection, setSelection] = useState(() => ({ source: seriesParam, keys: readMetricKeys(seriesParam) }));
  const persisted = selection.source === seriesParam ? selection.keys : readMetricKeys(seriesParam);
  const [preview, setPreview] = useState<MetricKey[] | null>(null);
  const previewRef = useRef<MetricKey[]>(persisted);
  const draggedRef = useRef<MetricKey | null>(null);
  const selected = preview ?? persisted;
  const [dragged, setDragged] = useState<MetricKey | null>(null);
  const [dropTarget, setDropTarget] = useState<MetricKey | null>(null);
  const chartData = useMemo(() => data.map((point) => ({ ...point, engagementRate: point.engagementRate * 100 })), [data]);
  const selectedSet = new Set(selected);
  const leftKeys = selected.filter((key) => metrics[key].axis === "left");
  const rightKeys = selected.filter((key) => metrics[key].axis === "right");
  const rightIsPercentOnly = rightKeys.length > 0 && rightKeys.every((key) => key === "engagementRate");
  const leftConfig = Object.fromEntries(leftKeys.map((key) => [key, { label: metrics[key].label, color: metrics[key].color }]));
  const rightConfig = Object.fromEntries(rightKeys.map((key) => [key, { label: metrics[key].label, color: metrics[key].color }]));
  const tooltipItemsAt = (index: number): TooltipItem[] => selected.map((key) => ({
    name: key,
    label: metrics[key].label,
    value: Number(chartData[index]?.[key] ?? 0),
    seed: seedOfColor(metrics[key].color),
    dimmed: false,
  }));
  const leftTop = Math.max(-1, ...leftKeys.map((key) => selected.indexOf(key)));
  const rightTop = Math.max(-1, ...rightKeys.map((key) => selected.indexOf(key)));
  const barsAreFront = rightKeys.length > 0 && (!leftKeys.length || rightTop > leftTop);
  const update = (keys: MetricKey[]) => {
    setSelection({ source: seriesParam, keys });
    const next = new URLSearchParams(params.toString());
    if (keys.join(",") === defaultMetricKeys.join(",")) next.delete("series");
    else next.set("series", keys.join(","));
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
  };
  const add = (key: MetricKey) => update(selected.includes(key) ? selected : [...selected, key].slice(-4));
  const remove = (key: MetricKey) => update(selected.length === 1 ? selected : selected.filter((item) => item !== key));
  const move = (item: MetricKey, target: MetricKey) => update(moveItem(selected, item, target));
  const beginPointerSort = (event: ReactPointerEvent<HTMLButtonElement>, key: MetricKey) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    previewRef.current = selected;
    draggedRef.current = key;
    setPreview(selected);
    setDragged(key);
    setDropTarget(null);
  };
  const continuePointerSort = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = draggedRef.current;
    if (!active) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-series-id]")?.dataset.seriesId as MetricKey | undefined;
    if (!target || target === active || !previewRef.current.includes(target)) return;
    setDropTarget(target);
    const next = moveItem(previewRef.current, active, target);
    previewRef.current = next;
    setPreview(next);
  };
  const finishPointerSort = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggedRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const next = previewRef.current;
    setPreview(null);
    draggedRef.current = null;
    setDragged(null);
    setDropTarget(null);
    update(next);
  };
  const cancelPointerSort = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setPreview(null);
    draggedRef.current = null;
    setDragged(null);
    setDropTarget(null);
  };

  return <div className="performance-chart-shell">
    <div className="performance-chart-toolbar">
      <div className="performance-metric-chips">
        {selected.map((key, index) => <span
          className="performance-metric-chip"
          data-dragging={dragged === key}
          data-drop-target={dropTarget === key}
          data-series-id={key}
          key={key}
          aria-label={`Reorder ${metrics[key].label}`}
          role="group"
          tabIndex={0}
          title="Drag to reorder; the last metric is drawn in front"
          style={{ "--metric-color": metrics[key].cssColor } as CSSProperties}
          onKeyDown={(event) => {
            if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            const targetIndex = event.key === "ArrowLeft" ? index - 1 : index + 1;
            const target = selected[targetIndex];
            if (target) move(key, target);
          }}
        >
          <button
            type="button"
            className="performance-chip-grip"
            aria-label={`Drag ${metrics[key].label}`}
            onPointerDown={(event) => beginPointerSort(event, key)}
            onPointerMove={continuePointerSort}
            onPointerUp={finishPointerSort}
            onPointerCancel={cancelPointerSort}
          ><GripVertical /></button>
          <i />{metrics[key].label}
          <span className="performance-chip-steps">
            <button type="button" aria-label={`Move ${metrics[key].label} left`} disabled={index === 0} onClick={() => move(key, selected[index - 1])}><ChevronLeft /></button>
            <button type="button" aria-label={`Move ${metrics[key].label} right`} disabled={index === selected.length - 1} onClick={() => move(key, selected[index + 1])}><ChevronRight /></button>
          </span>
          <button type="button" draggable={false} aria-label={`Remove ${metrics[key].label}`} disabled={selected.length === 1} onClick={(event) => { event.stopPropagation(); remove(key); }}><X /></button>
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
      {rightKeys.length ? <div className="performance-chart-layer performance-chart-bars" style={{ zIndex: barsAreFront ? 2 : 1, pointerEvents: barsAreFront ? "auto" : "none" }}>
        <BarChart data={chartData} config={rightConfig} bloom="low" interactive={barsAreFront} margins={{ top: 12, right: 46, bottom: 30, left: 54 }}>
          <Grid />
          <XAxis dataKey="date" maxTicks={7} tickFormatter={(value) => shortDate(String(value))} />
          <YAxis orientation="right" tickFormatter={(value) => rightIsPercentOnly ? `${value.toFixed(0)}%` : formatNumber(value)} />
          {barsAreFront ? <Tooltip labelKey="date" itemsAt={tooltipItemsAt} variant="frosted-glass" valueFormatter={(value, name) => metricValue(name as MetricKey, value)} /> : null}
          {rightKeys.map((key, index) => <Bar key={key} dataKey={key} variant={index % 2 ? "dotted" : "hatched"} />)}
        </BarChart>
      </div> : null}
      {leftKeys.length ? <div className="performance-chart-layer performance-chart-lines" style={{ zIndex: barsAreFront ? 1 : 2, pointerEvents: barsAreFront ? "none" : "auto" }}>
        <AreaChart data={chartData} config={leftConfig} bloom="aura" interactive={!barsAreFront} margins={{ top: 12, right: 46, bottom: 30, left: 54 }}>
          {!rightKeys.length ? <><Grid /><XAxis dataKey="date" maxTicks={7} tickFormatter={(value) => shortDate(String(value))} /></> : null}
          <YAxis tickFormatter={formatNumber} />
          {!barsAreFront ? <Tooltip labelKey="date" itemsAt={tooltipItemsAt} variant="frosted-glass" valueFormatter={(value, name) => metricValue(name as MetricKey, value)} /> : null}
          {leftKeys.map((key, index) => <Area key={key} dataKey={key} variant={index === 0 ? "gradient" : index % 2 ? "dotted" : "hatched"} strokeVariant={metrics[key].dashed ? "dashed" : "solid"} />)}
        </AreaChart>
      </div> : null}
    </div>
  </div>;
}
