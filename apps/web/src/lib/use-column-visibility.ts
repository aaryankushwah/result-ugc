"use client";

import { useEffect, useRef, useState } from "react";
import type { VisibilityState } from "@tanstack/react-table";

const storageKey = (table: string) => `result-columns:${table}`;

/**
 * Column choices persist per table, so the set a manager pins stays pinned
 * across reloads instead of resetting to the defaults on every visit.
 *
 * Stored values are read in an effect rather than during render: localStorage is
 * not available on the server, and seeding state from it would hydrate mismatched.
 */
export function useColumnVisibility(table: string, defaults: VisibilityState = {}) {
  const defaultsRef = useRef(defaults);
  const [visibility, setVisibility] = useState<VisibilityState>(defaults);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let next = defaultsRef.current;
    try {
      const stored = window.localStorage.getItem(storageKey(table));
      if (stored) next = { ...defaultsRef.current, ...(JSON.parse(stored) as VisibilityState) };
    } catch { /* A blocked or corrupt store just means the defaults apply. */ }
    setVisibility(next);
    setLoaded(true);
  }, [table]);

  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(storageKey(table), JSON.stringify(visibility)); } catch { /* Non-fatal: the choice simply will not persist. */ }
  }, [table, visibility, loaded]);

  return [visibility, setVisibility] as const;
}
