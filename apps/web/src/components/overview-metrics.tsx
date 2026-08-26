"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Activity, AlertTriangle, BadgeDollarSign, Bookmark, Check, CircleUserRound, Eye, FileVideo2, Gauge, GripVertical, Heart, Link2, MessageCircleMore, RotateCcw, Settings2, Share2, UserPlus, UsersRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { defaultOverviewMetricIds, readOverviewMetricIds, toggleOverviewMetric, type OverviewMetricId } from "@/lib/overview-metrics";
import { moveItem } from "@/lib/reorder";

const icons = { activity: Activity, alert: AlertTriangle, bookmark: Bookmark, accounts: CircleUserRound, cpm: BadgeDollarSign, eye: Eye, video: FileVideo2, gauge: Gauge, heart: Heart, comments: MessageCircleMore, share: Share2, applicants: UserPlus, creators: UsersRound };

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
  const statsParam = params.get("stats");
  const [selection, setSelection] = useState(() => ({ source: statsParam, ids: readOverviewMetricIds(statsParam) }));
  const selected = selection.source === statsParam ? selection.ids : readOverviewMetricIds(statsParam);
  const update = (ids: OverviewMetricId[]) => {
    // Keep reorders and visibility changes rendered while the URL transition catches up.
    setSelection({ source: statsParam, ids });
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

export function CopyOverviewViewButton() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  };
  return <Button variant="outline" onClick={copy}>{copied ? <Check /> : <Link2 />}{copied ? "Copied" : "Copy this view"}</Button>;
}

export function OverviewMetricGrid({ metrics }: { metrics: OverviewMetric[] }) {
  const { selected, update } = useMetricSelection();
  const [preview, setPreview] = useState<OverviewMetricId[] | null>(null);
  const previewRef = useRef<OverviewMetricId[]>(selected);
  const draggedRef = useRef<OverviewMetricId | null>(null);
  const ordered = preview ?? selected;
  const [dragged, setDragged] = useState<OverviewMetricId | null>(null);
  const [dropTarget, setDropTarget] = useState<OverviewMetricId | null>(null);
  const visible = ordered.flatMap((id) => {
    const metric = metrics.find((item) => item.id === id);
    return metric ? [metric] : [];
  });
  const move = (item: OverviewMetricId, target: OverviewMetricId) => update(moveItem(ordered, item, target));
  const beginPointerSort = (event: ReactPointerEvent<HTMLButtonElement>, id: OverviewMetricId) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    previewRef.current = ordered;
    draggedRef.current = id;
    setPreview(ordered);
    setDragged(id);
    setDropTarget(null);
  };
  const continuePointerSort = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = draggedRef.current;
    if (!active) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-stat-id]")?.dataset.statId as OverviewMetricId | undefined;
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
  return <section className="metric-grid overview-metric-grid">
    {visible.map((metric, index) => {
      const Icon = icons[metric.icon];
      return <Card
        className={`metric-card overview-metric-card ${metric.attention ? "metric-attention" : ""}`}
        data-dragging={dragged === metric.id}
        data-drop-target={dropTarget === metric.id}
        data-stat-id={metric.id}
        key={metric.id}
        tabIndex={0}
        title="Drag to reorder"
        onKeyDown={(event) => {
          if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
          event.preventDefault();
          const targetIndex = event.key === "ArrowLeft" ? index - 1 : index + 1;
          const target = visible[targetIndex];
          if (target) move(metric.id, target.id);
        }}
      >
        <div className="metric-icon"><Icon /></div>
        <div className="overview-metric-copy">
          <p>{metric.label}</p>
          <strong>{metric.value}</strong>
        </div>
        <button
          type="button"
          className="overview-metric-grip"
          aria-label={`Drag ${metric.label}`}
          onPointerDown={(event) => beginPointerSort(event, metric.id)}
          onPointerMove={continuePointerSort}
          onPointerUp={finishPointerSort}
          onPointerCancel={cancelPointerSort}
        ><GripVertical /></button>
      </Card>;
    })}
  </section>;
}
