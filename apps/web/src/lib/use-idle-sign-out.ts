"use client";

import { useEffect } from "react";

/** Working default (context §13.1 spirit): a customer host left alone on a shared device signs out after this. */
export const IDLE_SIGN_OUT_MS = 30 * 60_000;
/** Shared across tabs: sign-out applies to the whole browser, so activity in any tab keeps every tab signed in. */
export const LAST_ACTIVITY_KEY = "orbit-support.last-activity";
const SHARE_EVERY_MS = 10_000;
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "touchstart", "scroll", "wheel"] as const;

function sharedLastActivity(): number {
  try {
    const value = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * Calls `onIdle` after `timeoutMs` without user activity in ANY tab of this browser while `enabled` (PH-7.3,
 * context §10.2 shared devices). Listeners capture, so scrolling inside the panel counts (a scroll event does not
 * bubble); the latest activity is shared through localStorage so a forgotten tab cannot sign out the tab the
 * person is using (Cycle Audit 3).
 */
export function useIdleSignOut(enabled: boolean, onIdle: () => void, timeoutMs = IDLE_SIGN_OUT_MS): void {
  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    let shared = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const share = (now: number) => {
      if (now - shared < SHARE_EVERY_MS) return;
      shared = now;
      try {
        window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      } catch {
        // Storage unavailable: each tab keeps its own timer.
      }
    };
    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(check, Math.max(0, delay));
    };
    const check = () => {
      const idleFor = Date.now() - Math.max(last, sharedLastActivity());
      if (idleFor >= timeoutMs) onIdle();
      else schedule(timeoutMs - idleFor);
    };
    const activity = () => {
      last = Date.now();
      share(last);
      schedule(timeoutMs);
    };
    share(last);
    schedule(timeoutMs);
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, activity, { capture: true, passive: true });
    document.addEventListener("visibilitychange", activity);
    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, activity, { capture: true });
      document.removeEventListener("visibilitychange", activity);
    };
  }, [enabled, onIdle, timeoutMs]);
}
