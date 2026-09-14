"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Whether a CSS media query currently matches; `fallback` is used during server rendering. */
export function useMediaQuery(query: string, fallback = true): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  const read = useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return fallback;
    return window.matchMedia(query).matches;
  }, [query, fallback]);
  return useSyncExternalStore(subscribe, read, () => fallback);
}
