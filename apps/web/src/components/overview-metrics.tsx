"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Activity, AlertTriangle, BadgeDollarSign, Bookmark, Check, CircleUserRound, Eye, FileVideo2, Gauge, GripVertical, Heart, Link2, MessageCircleMore, RotateCcw, Settings2, Share2, UserPlus, UsersRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { defaultOverviewMetricIds, readOverviewMetricIds, toggleOverviewMetric, type OverviewMetricId } from "@/lib/overview-metrics";
import { moveItem, moveItemRelative } from "@/lib/reorder";

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
  const gridRef = useRef<HTMLElement>(null);
  const [preview, setPreview] = useState<OverviewMetricId[] | null>(null);
  const previewRef = useRef<OverviewMetricId[]>(selected);
  const draggedRef = useRef<OverviewMetricId | null>(null);
  const pointerRef = useRef<{ id: OverviewMetricId; pointerId: number; startX: number; startY: number } | null>(null);
  const ordered = preview ?? selected;
  const [dragged, setDragged] = useState<OverviewMetricId | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: OverviewMetricId; edge: "before" | "after" } | null>(null);
  const visible = ordered.flatMap((id) => {
    const metric = metrics.find((item) => item.id === id);
    return metric ? [metric] : [];
  });
  const move = (item: OverviewMetricId, target: OverviewMetricId) => update(moveItem(ordered, item, target));
  const beginPointerSort = (event: ReactPointerEvent<HTMLDivElement>, id: OverviewMetricId) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
  };
  const continuePointerSort = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;

    if (!draggedRef.current) {
      const horizontalDistance = Math.abs(event.clientX - pointer.startX);
      const verticalDistance = Math.abs(event.clientY - pointer.startY);
      if (horizontalDistance < 7 || horizontalDistance < verticalDistance) return;
      event.preventDefault();
      previewRef.current = ordered;
      draggedRef.current = pointer.id;
      setPreview(ordered);
      setDragged(pointer.id);
    }

    const active = draggedRef.current;
    if (!active) return;
    event.preventDefault();

    const grid = gridRef.current;
    if (grid) {
      const bounds = grid.getBoundingClientRect();
      if (event.clientX < bounds.left + 36) grid.scrollLeft -= 14;
      else if (event.clientX > bounds.right - 36) grid.scrollLeft += 14;
    }

    const targetElement = document.elementsFromPoint(event.clientX, event.clientY)
      .map((element) => element.closest<HTMLElement>("[data-stat-id]"))
      .find((element) => element?.dataset.statId && element.dataset.statId !== active);
    const target = targetElement?.dataset.statId as OverviewMetricId | undefined;
    if (!targetElement || !target || !previewRef.current.includes(target)) {
      setDropTarget(null);
      return;
    }

    const edge = event.clientX < targetElement.getBoundingClientRect().left + targetElement.offsetWidth / 2 ? "before" : "after";
    setDropTarget({ id: target, edge });
    const next = moveItemRelative(previewRef.current, active, target, edge);
    if (next.every((id, index) => id === previewRef.current[index])) return;
    previewRef.current = next;
    setPreview(next);
  };
  const finishPointerSort = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const wasDragging = Boolean(draggedRef.current);
    const next = previewRef.current;
    pointerRef.current = null;
    setPreview(null);
    draggedRef.current = null;
    setDragged(null);
    setDropTarget(null);
    if (wasDragging) update(next);
  };
  const cancelPointerSort = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pointerRef.current = null;
    setPreview(null);
    draggedRef.current = null;
    setDragged(null);
    setDropTarget(null);
  };
  return <section className="metric-grid overview-metric-grid" ref={gridRef}>
    {visible.map((metric, index) => {
      const Icon = icons[metric.icon];
      return <Card
        className={`metric-card overview-metric-card ${metric.attention ? "metric-attention" : ""}`}
        data-dragging={dragged === metric.id}
        data-drop-edge={dropTarget?.id === metric.id ? dropTarget.edge : undefined}
        data-stat-id={metric.id}
        key={metric.id}
        tabIndex={0}
        title="Drag to reorder · Alt + arrow keys also work"
        onPointerDown={(event) => beginPointerSort(event, metric.id)}
        onPointerMove={continuePointerSort}
        onPointerUp={finishPointerSort}
        onPointerCancel={cancelPointerSort}
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
        <span className="overview-metric-grip" aria-hidden="true"><GripVertical /></span>
      </Card>;
    })}
  </section>;
}
