"use client";

import { useState } from "react";
import { Activity, AlertTriangle, Bookmark, CircleUserRound, Eye, FileVideo2, Gauge, GripVertical, Heart, MessageCircleMore, RotateCcw, Settings2, Share2, UserPlus, UsersRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DitherGradient } from "@/components/dither-kit/gradient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { defaultOverviewMetricIds, readOverviewMetricIds, toggleOverviewMetric, type OverviewMetricId } from "@/lib/overview-metrics";
import { moveItem } from "@/lib/reorder";

const icons = { activity: Activity, alert: AlertTriangle, bookmark: Bookmark, accounts: CircleUserRound, eye: Eye, video: FileVideo2, gauge: Gauge, heart: Heart, comments: MessageCircleMore, share: Share2, applicants: UserPlus, creators: UsersRound };

export type OverviewMetric = {
  id: OverviewMetricId;
  label: string;
  value: string;
  icon: keyof typeof icons;
  attention?: boolean;
};

function useMetricSelection() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const selected = readOverviewMetricIds(params.get("stats"));
  const update = (ids: OverviewMetricId[]) => {
    const next = new URLSearchParams(params.toString());
    if (ids.join(",") === defaultOverviewMetricIds.join(",")) next.delete("stats");
    else next.set("stats", ids.join(","));
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
  };
  return { selected, update };
}

export function OverviewMetricPicker({ metrics }: { metrics: OverviewMetric[] }) {
  const { selected, update } = useMetricSelection();
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="outline" className="overview-stats-button"><Settings2 /> Stats <span>{selected.length}</span></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-56">
      <DropdownMenuLabel>Visible dashboard stats</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {metrics.map((metric) => <DropdownMenuCheckboxItem key={metric.id} checked={selected.includes(metric.id)} onCheckedChange={() => update(toggleOverviewMetric(selected, metric.id))} onSelect={(event) => event.preventDefault()}>{metric.label}</DropdownMenuCheckboxItem>)}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => update(defaultOverviewMetricIds)}><RotateCcw /> Reset defaults</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

export function OverviewMetricGrid({ metrics }: { metrics: OverviewMetric[] }) {
  const { selected, update } = useMetricSelection();
  const [dragged, setDragged] = useState<OverviewMetricId | null>(null);
  const [dropTarget, setDropTarget] = useState<OverviewMetricId | null>(null);
  const visible = selected.flatMap((id) => {
    const metric = metrics.find((item) => item.id === id);
    return metric ? [metric] : [];
  });
  const move = (item: OverviewMetricId, target: OverviewMetricId) => update(moveItem(selected, item, target));
  return <section className="metric-grid overview-metric-grid">
    {visible.map((metric, index) => {
      const Icon = icons[metric.icon];
      const ditherColor = metric.attention ? "orange" : ["likes", "comments", "shares", "bookmarks", "engagement"].includes(metric.id) ? "pink" : ["views", "averageViews", "videos"].includes(metric.id) ? "blue" : "purple";
      return <Card
        className={`metric-card overview-metric-card ${metric.attention ? "metric-attention" : ""}`}
        data-dragging={dragged === metric.id}
        data-drop-target={dropTarget === metric.id}
        draggable
        key={metric.id}
        tabIndex={0}
        title="Drag to reorder"
        onDragStart={(event) => {
          setDragged(metric.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", metric.id);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDragEnter={() => {
          if (dragged && dragged !== metric.id) setDropTarget(metric.id);
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (dragged) move(dragged, metric.id);
          setDragged(null);
          setDropTarget(null);
        }}
        onDragEnd={() => {
          setDragged(null);
          setDropTarget(null);
        }}
        onKeyDown={(event) => {
          if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
          event.preventDefault();
          const targetIndex = event.key === "ArrowLeft" ? index - 1 : index + 1;
          const target = visible[targetIndex];
          if (target) move(metric.id, target.id);
        }}
      >
        <DitherGradient from={ditherColor} direction="right" cell={2} opacity={metric.attention ? 0.34 : 0.28} className="overview-metric-dither" />
        <div className="metric-icon"><Icon /></div>
        <div className="overview-metric-copy">
          <p>{metric.label}</p>
          <strong>{metric.value}</strong>
        </div>
        <GripVertical aria-hidden="true" className="overview-metric-grip" />
      </Card>;
    })}
  </section>;
}
