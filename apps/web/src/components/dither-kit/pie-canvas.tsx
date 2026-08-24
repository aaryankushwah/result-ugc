"use client"

import { useEffect, useRef } from "react"
import {
  BAYER,
  BORDER_ALPHA,
  CELL,
  OFF_TIER,
  backingSize,
  bloomLayerStyle,
  clamp01,
  easeOutCubic,
  prefersReducedMotion,
} from "./dither-paint"
import { rgb } from "./palette"
import { usePolarChart } from "./polar-context"

const TAU = Math.PI * 2
const TOP = -Math.PI / 2

/** Gap carved between neighbouring slices, in css px of arc at the outer edge. */
const SLICE_GAP = 2
/** Thickness of the bright rim that caps each slice, in css px. */
const RIM = 2

/**
 * Dither canvas for pie / donut charts — the polar counterpart of
 * {@link BarCanvas}. Every slice is one colour whose alpha is modulated by the
 * shared ordered dither: dense at the inner edge and dissolving outward, so the
 * wedge fades toward its rim exactly as a bar fades toward its value line. The
 * disc sweeps open clockwise from twelve o'clock; the hovered slice lifts while
 * the rest dim.
 */
export function PieCanvas() {
  const ctx = usePolarChart()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bloomRef = useRef<HTMLCanvasElement>(null)

  const { width, height } = ctx.plot
  const { cols, rows } = backingSize(width, height)
  const { ready, pie, center, outerRadius, innerRadius, hoverIndex } = ctx

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !ready || !pie?.length) return
    const context = canvas.getContext("2d")
    if (!context) return

    canvas.width = cols
    canvas.height = rows
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const bloom = bloomRef.current
    if (bloom) {
      bloom.width = cols
      bloom.height = rows
      bloom.style.width = `${width}px`
      bloom.style.height = `${height}px`
    }

    // Backing cells are CELL css px, so every geometry value works in cells.
    const scale = 1 / CELL
    const cx = center.x * scale
    const cy = center.y * scale
    const outer = outerRadius * scale
    const inner = innerRadius * scale
    const rim = RIM * scale
    const gap = SLICE_GAP * scale

    const paint = (progress: number) => {
      context.clearRect(0, 0, cols, rows)
      const sweep = TOP + TAU * progress
      for (let row = 0; row < rows; row += 1) {
        const dy = row + 0.5 - cy
        for (let col = 0; col < cols; col += 1) {
          const dx = col + 0.5 - cx
          const radius = Math.hypot(dx, dy)
          if (radius > outer || radius < inner) continue

          // Normalise into [TOP, TOP + TAU) so slice ranges compare directly.
          let angle = Math.atan2(dy, dx)
          while (angle < TOP) angle += TAU
          while (angle >= TOP + TAU) angle -= TAU
          if (angle > sweep) continue

          const index = pie.findIndex((slice) => angle >= slice.start && angle < slice.end)
          if (index < 0) continue
          const slice = pie[index]!

          // Carve a constant-width gap so neighbouring wedges never touch.
          const half = gap / 2 / Math.max(radius, 1)
          if (pie.length > 1 && (angle - slice.start < half || slice.end - angle < half)) continue

          const seed = ctx.seedOf(slice.name)
          const focused = hoverIndex == null || hoverIndex === index
          const dim = focused ? 1 : 0.42
          const lift = hoverIndex === index ? 1.18 : 1

          if (outer - radius <= rim) {
            context.fillStyle = rgb(seed.fill, 1, BORDER_ALPHA * dim * lift)
            context.fillRect(col, row, 1, 1)
            continue
          }

          // Solid at the inner edge, dissolving toward the rim.
          const span = Math.max(outer - inner, 1)
          const t = clamp01((radius - inner) / span)
          const density = clamp01((1 - t * 0.72) * lift)
          const on = density > BAYER[row & 3]![col & 3]!
          const alpha = (on ? density : density * OFF_TIER) * dim
          if (alpha <= 0.01) continue
          context.fillStyle = rgb(seed.fill, 1, alpha)
          context.fillRect(col, row, 1, 1)
        }
      }
      if (bloom) {
        const bloomContext = bloom.getContext("2d")
        if (bloomContext) {
          bloomContext.clearRect(0, 0, cols, rows)
          bloomContext.drawImage(canvas, 0, 0)
        }
      }
    }

    if (!ctx.animate || prefersReducedMotion()) {
      paint(1)
      return
    }

    let raf = 0
    const started = performance.now()
    const draw = (now: number) => {
      const progress = clamp01((now - started) / Math.max(1, ctx.animationDuration))
      paint(easeOutCubic(progress))
      if (progress < 1) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
    // ctx is a fresh object each render; depend on the values actually painted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, rows, width, height, ready, pie, center.x, center.y, outerRadius, innerRadius, hoverIndex, ctx.revision])

  const bloomActive = ctx.bloomOnHover ? ctx.isMouseInChart || hoverIndex != null : true
  const bloomStyle = bloomLayerStyle(ctx.bloom, bloomActive)
  const position = { left: ctx.margins.left, top: ctx.margins.top, width, height } as const

  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none absolute" style={{ ...position, imageRendering: "pixelated" }} />
      <canvas
        ref={bloomRef}
        className="pointer-events-none absolute"
        style={{ ...position, transition: "opacity 220ms ease", ...(bloomStyle ?? { opacity: 0 }) }}
      />
    </>
  )
}
