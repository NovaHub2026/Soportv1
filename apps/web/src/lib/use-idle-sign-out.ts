"use client";

import { useEffect } from "react";

/** Working default (context §13.1 spirit): a customer host left alone on a shared device signs out after this. */
export const IDLE_SIGN_OUT_MS = 30 * 60_000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll"] as const;

/**
 * Calls `onIdle` after `timeoutMs` without user activity while `enabled` (PH-7.3, context §10.2 shared devices).
 * Activity resets the timer; the page becoming visible again counts as activity.
 */
export function useIdleSignOut(enabled: boolean, onIdle: () => void, timeoutMs = IDLE_SIGN_OUT_MS): void {
  useEffect(() => {
    if (!enabled) return;
    let timer = setTimeout(onIdle, timeoutMs);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onIdle, timeoutMs);
    };
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, reset, { passive: true });
    document.addEventListener("visibilitychange", reset);
    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [enabled, onIdle, timeoutMs]);
}
