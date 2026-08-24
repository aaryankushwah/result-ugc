"use client"

import { PieCanvas } from "./pie-canvas"
import { PolarRoot, type PolarRootProps } from "./polar-root"

type Row = object

export type PieChartProps<TData extends Row> = Omit<PolarRootProps<TData>, "chartType" | "Canvas">

/** Composable dither **pie / donut** chart. Compose `<Pie>`, `<Tooltip>`, … inside. */
export function PieChart<TData extends Row>(props: PieChartProps<TData>) {
  return <PolarRoot chartType="pie" Canvas={PieCanvas} {...props} />
}
