"use client"

import { useEffect } from "react"
import type { AreaVariant } from "./chart-context"
import { usePolarPart } from "./polar-context"

export type PieProps = { variant?: AreaVariant }

/**
 * Declares the pie's slices. The painting happens in {@link PieCanvas}, driven
 * by the slice geometry the root computes — this part only registers the fill
 * variant, mirroring how `<Bar>` and `<Area>` behave in the cartesian family.
 */
export function Pie({ variant = "gradient" }: PieProps) {
  const ctx = usePolarPart("Pie", "pie")
  const { registerVariant, unregisterVariant, configKeys } = ctx
  useEffect(() => {
    for (const key of configKeys) registerVariant(key, variant)
    return () => {
      for (const key of configKeys) unregisterVariant(key)
    }
  }, [configKeys, registerVariant, unregisterVariant, variant])
  return null
}
