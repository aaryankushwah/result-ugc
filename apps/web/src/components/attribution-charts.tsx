"use client";

import { AreaChart } from "@/components/dither-kit/area-chart";
import { Area } from "@/components/dither-kit/area";
import { Grid } from "@/components/dither-kit/grid";
import { Tooltip } from "@/components/dither-kit/tooltip";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";
import type { PortalAttributionPoint } from "@/lib/portal-types";
import { formatNumber } from "./ui";

const countConfig = {
  clicks: { label: "Clicks", color: "purple" as const },
  leads: { label: "Leads", color: "blue" as const },
  conversions: { label: "Conversions", color: "orange" as const },
};

const revenueConfig = {
  revenue: { label: "Revenue", color: "green" as const },
};

const shortDate = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric" });

export function AttributionCharts({ data }: { data: PortalAttributionPoint[] }) {
  return (
    <div className="attribution-chart-grid">
      <section className="panel attribution-chart-panel">
        <div className="panel-header"><h2>Attribution volume</h2></div>
        <div className="attribution-chart-canvas">
          <AreaChart data={data} config={countConfig} bloom="aura" margins={{ top: 12, right: 24, bottom: 32, left: 52 }}>
            <Grid />
            <XAxis dataKey="date" maxTicks={7} tickFormatter={(value) => shortDate(String(value))} />
            <YAxis tickFormatter={formatNumber} />
            <Tooltip labelKey="date" variant="frosted-glass" valueFormatter={(value) => formatNumber(value)} />
            <Area dataKey="clicks" variant="gradient" />
            <Area dataKey="leads" variant="dotted" />
            <Area dataKey="conversions" variant="hatched" />
          </AreaChart>
        </div>
      </section>
      <section className="panel attribution-chart-panel attribution-revenue-chart">
        <div className="panel-header"><h2>Attributed revenue</h2></div>
        <div className="attribution-chart-canvas">
          <AreaChart data={data} config={revenueConfig} bloom="low" margins={{ top: 12, right: 24, bottom: 32, left: 52 }}>
            <Grid />
            <XAxis dataKey="date" maxTicks={5} tickFormatter={(value) => shortDate(String(value))} />
            <YAxis tickFormatter={(value) => `$${formatNumber(value)}`} />
            <Tooltip labelKey="date" variant="frosted-glass" valueFormatter={(value) => `$${value.toFixed(2)}`} />
            <Area dataKey="revenue" variant="gradient" />
          </AreaChart>
        </div>
      </section>
    </div>
  );
}
