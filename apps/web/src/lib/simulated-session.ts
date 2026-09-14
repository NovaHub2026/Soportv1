"use client";

import { SIMULATED_STAFF_DIRECTORY, type SimulatedStaffMember } from "@orbit-support/shared";
import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * SIMULATED sessions. Orbit has no accounts yet (DEC-0003); the UI lets a developer pick which fictional
 * customer or staff member the browser acts as. Choices are remembered per browser and always labeled.
 * "Sair" (PH-7.3, context §10.2) forgets the choice and every per-session buffer so the next person on a shared
 * device starts from a neutral picker with nothing of the previous identity on screen or in storage.
 *
 * Three states (Cycle Audit 3): `undefined` — not known yet (the server render and the first client render, which
 * must be identity-neutral: nothing identity-bound is rendered, fetched or streamed); `null` — signed out; a value —
 * signed in.
 */
export interface SimulatedCustomer {
  id: string;
  name: string;
}

export type SimulatedStaff = SimulatedStaffMember;

export const SIMULATED_CUSTOMERS: readonly SimulatedCustomer[] = [
  { id: "cust-alice", name: "Alice Souza" },
  { id: "cust-bruno", name: "Bruno Lima" },
  { id: "cust-carla", name: "Carla Mendes" },
];

/** The shared directory is the single source: the API validates transfer targets against the same list. */
export const SIMULATED_STAFF: readonly SimulatedStaff[] = SIMULATED_STAFF_DIRECTORY;

/** Every key this app writes to `sessionStorage` starts with this prefix (pending message buffers). */
export const SESSION_STORAGE_PREFIX = "orbit-support.";

/** Removes every per-session buffer of the app (unsent drafts of any customer and case). */
export function clearSessionBuffers(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(SESSION_STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.sessionStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing was persisted in the first place.
  }
}

interface SessionStore<T> {
  read(): T | null;
  subscribe(onChange: () => void): () => void;
  select(id: string): void;
  signOut(): void;
}

function createStore<T extends { id: string }>(storageKey: string, options: readonly T[]): SessionStore<T> {
  const changeEvent = `${storageKey}:changed`;
  const signedOutKey = `${storageKey}:signed-out`;

  function read(): T | null {
    try {
      if (window.localStorage.getItem(signedOutKey) === "1") return null;
      const id = window.localStorage.getItem(storageKey);
      return options.find((o) => o.id === id) ?? options[0];
    } catch {
      return options[0];
    }
  }

  function subscribe(onChange: () => void): () => void {
    window.addEventListener("storage", onChange);
    window.addEventListener(changeEvent, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(changeEvent, onChange);
    };
  }

  function select(id: string) {
    try {
      window.localStorage.setItem(storageKey, id);
      window.localStorage.removeItem(signedOutKey);
    } catch {
      // Storage unavailable (private mode): the selection simply does not persist.
    }
    window.dispatchEvent(new Event(changeEvent));
  }

  function signOut() {
    try {
      window.localStorage.removeItem(storageKey);
      window.localStorage.setItem(signedOutKey, "1");
    } catch {
      // Storage unavailable: the in-memory state below still resets through the event.
    }
    clearSessionBuffers();
    window.dispatchEvent(new Event(changeEvent));
  }

  return { read, subscribe, select, signOut };
}

const customerStore = createStore("orbit-support.simulated-customer", SIMULATED_CUSTOMERS);
const staffStore = createStore("orbit-support.simulated-staff", SIMULATED_STAFF);

/** The server does not know who uses the browser: its snapshot is "not known yet" (Cycle Audit 3). */
const unknownOnServer = () => undefined;

/** Signing out in another tab arrives as a storage event: this tab clears its own buffers too (Cycle Audit 3). */
function useClearBuffersWhenSignedOut(value: unknown): void {
  useEffect(() => {
    if (value === null) clearSessionBuffers();
  }, [value]);
}

/** `undefined` until the browser value is read, `null` while signed out (PH-7.3), else the customer. */
export function useSimulatedCustomer(): [SimulatedCustomer | null | undefined, (id: string) => void, () => void] {
  const customer = useSyncExternalStore<SimulatedCustomer | null | undefined>(customerStore.subscribe, customerStore.read, unknownOnServer);
  useClearBuffersWhenSignedOut(customer);
  const select = useCallback((id: string) => customerStore.select(id), []);
  const signOut = useCallback(() => customerStore.signOut(), []);
  return [customer, select, signOut];
}

export function useSimulatedStaff(): [SimulatedStaff | null | undefined, (id: string) => void, () => void] {
  const staff = useSyncExternalStore<SimulatedStaff | null | undefined>(staffStore.subscribe, staffStore.read, unknownOnServer);
  useClearBuffersWhenSignedOut(staff);
  const select = useCallback((id: string) => staffStore.select(id), []);
  const signOut = useCallback(() => staffStore.signOut(), []);
  return [staff, select, signOut];
}
