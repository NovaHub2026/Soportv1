"use client";

import { SIMULATED_STAFF_DIRECTORY, type SimulatedStaffMember } from "@orbit-support/shared";
import { useCallback, useSyncExternalStore } from "react";

/**
 * SIMULATED sessions. Orbit has no accounts yet (DEC-0003); the UI lets a developer pick which fictional
 * customer or staff member the browser acts as. Choices are remembered per browser and always labeled.
 * "Sair" (PH-7.3, context §10.2) forgets the choice and every per-session buffer so the next person on a shared
 * device starts from a neutral picker with nothing of the previous identity on screen or in storage.
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
  fallback: T;
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

  return { read, subscribe, select, signOut, fallback: options[0] };
}

const customerStore = createStore("orbit-support.simulated-customer", SIMULATED_CUSTOMERS);
const staffStore = createStore("orbit-support.simulated-staff", SIMULATED_STAFF);

/** `null` while signed out (PH-7.3): the shell shows the neutral picker and mounts nothing identity-bound. */
export function useSimulatedCustomer(): [SimulatedCustomer | null, (id: string) => void, () => void] {
  const customer = useSyncExternalStore(customerStore.subscribe, customerStore.read, () => customerStore.fallback);
  const select = useCallback((id: string) => customerStore.select(id), []);
  const signOut = useCallback(() => customerStore.signOut(), []);
  return [customer, select, signOut];
}

export function useSimulatedStaff(): [SimulatedStaff | null, (id: string) => void, () => void] {
  const staff = useSyncExternalStore(staffStore.subscribe, staffStore.read, () => staffStore.fallback);
  const select = useCallback((id: string) => staffStore.select(id), []);
  const signOut = useCallback(() => staffStore.signOut(), []);
  return [staff, select, signOut];
}
