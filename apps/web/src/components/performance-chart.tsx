"use client";

import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PerformancePoint } from "@/lib/portal-types";
import { formatNumber } from "./ui";

export function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  return <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}><defs><linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#85ed75" stopOpacity={0.3} /><stop offset="100%" stopColor="#85ed75" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(255,255,255,.055)" /><XAxis dataKey="date" tickFormatter={(value) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric" })} minTickGap={38} axisLine={false} tickLine={false} tick={{ fill: "#737373", fontSize: 10 }} /><YAxis yAxisId="views" axisLine={false} tickLine={false} tick={{ fill: "#737373", fontSize: 10 }} tickFormatter={formatNumber} /><YAxis yAxisId="posts" orientation="right" axisLine={false} tickLine={false} tick={{ fill: "#737373", fontSize: 10 }} allowDecimals={false} /><Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,.025)" }} /><Bar yAxisId="posts" dataKey="posts" name="Posts" fill="#fc5f2b" fillOpacity={0.5} radius={[2, 2, 0, 0]} maxBarSize={20} /><Area yAxisId="views" type="monotone" dataKey="views" name="Views" stroke="#85ed75" strokeWidth={2} fill="url(#viewsFill)" /></ComposedChart></ResponsiveContainer></div>;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{label ? new Date(`${label}T00:00:00Z`).toLocaleDateString("en", { month: "long", day: "numeric" }) : ""}</strong>{payload.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}<b>{formatNumber(item.value)}</b></span>)}</div>;
}
