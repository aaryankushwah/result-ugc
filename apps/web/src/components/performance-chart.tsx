"use client";

import { AreaChart } from "@/components/dither-kit/area-chart";
import { Area } from "@/components/dither-kit/area";
import { Grid } from "@/components/dither-kit/grid";
import { Tooltip } from "@/components/dither-kit/tooltip";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";
import type { PerformancePoint } from "@/lib/portal-types";
import { formatNumber } from "./ui";

const config = { views: { label: "Views", color: "purple" as const } };

export function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  return <div className="chart-wrap dither-chart-wrap"><AreaChart data={data} config={config} bloom="aura" margins={{ top: 18, right: 18, bottom: 28, left: 48 }}><Grid /><XAxis dataKey="date" maxTicks={7} tickFormatter={(value) => new Date(`${String(value)}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric" })} /><YAxis tickFormatter={formatNumber} /><Tooltip labelKey="date" variant="frosted-glass" valueFormatter={(value) => `${formatNumber(value)} views`} /><Area dataKey="views" variant="gradient" /></AreaChart></div>;
}
