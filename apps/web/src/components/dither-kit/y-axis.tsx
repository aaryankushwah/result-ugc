"use client"

import { useChartPart } from "./chart-context"

export function YAxis({
  tickFormatter,
  tickCount = 4,
  tickMargin = 8,
  orientation = "left",
}: {
  tickFormatter?: (value: number) => string
  tickCount?: number
  tickMargin?: number
  orientation?: "left" | "right"
}) {
  const ctx = useChartPart("YAxis")
  if (!ctx.ready) return null
  const x = orientation === "right" ? ctx.plot.width + tickMargin : -tickMargin

  return (
    <g className="fill-current font-mono text-[10px] text-muted-foreground">
      {ctx.y.ticks(tickCount).map((t) => (
        <text
          key={t}
          x={x}
          y={ctx.y(t)}
          textAnchor={orientation === "right" ? "start" : "end"}
          dominantBaseline="central"
          fill="currentColor"
        >
          {tickFormatter ? tickFormatter(t) : t}
        </text>
      ))}
    </g>
  )
}
