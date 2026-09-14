"use client";

import type { StaffRole } from "@orbit-support/shared";
import { useCallback, useSyncExternalStore } from "react";

/**
 * SIMULATED sessions. Orbit has no accounts yet (DEC-0003); the UI lets a developer pick which fictional
 * customer or staff member the browser acts as. Choices are remembered per browser and always labeled.
 */
export interface SimulatedCustomer {
  id: string;
  name: string;
}

export interface SimulatedStaff {
  id: string;
  name: string;
  role: StaffRole;
}

export const SIMULATED_CUSTOMERS: readonly SimulatedCustomer[] = [
  { id: "cust-alice", name: "Alice Souza" },
  { id: "cust-bruno", name: "Bruno Lima" },
  { id: "cust-carla", name: "Carla Mendes" },
];

export const SIMULATED_STAFF: readonly SimulatedStaff[] = [
  { id: "staff-ana", name: "Ana Ribeiro", role: "agent" },
  { id: "staff-bruno", name: "Bruno Costa", role: "agent" },
  { id: "staff-carla", name: "Carla Nunes", role: "supervisor" },
];

function createStore<T extends { id: string }>(storageKey: string, options: readonly T[]) {
  const changeEvent = `${storageKey}:changed`;

  function read(): T {
    try {
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
    } catch {
      // Storage unavailable (private mode): the selection simply does not persist.
    }
    window.dispatchEvent(new Event(changeEvent));
  }

  return { read, subscribe, select, fallback: options[0] };
}

const customerStore = createStore("orbit-support.simulated-customer", SIMULATED_CUSTOMERS);
const staffStore = createStore("orbit-support.simulated-staff", SIMULATED_STAFF);

export function useSimulatedCustomer(): [SimulatedCustomer, (id: string) => void] {
  const customer = useSyncExternalStore(customerStore.subscribe, customerStore.read, () => customerStore.fallback);
  const select = useCallback((id: string) => customerStore.select(id), []);
  return [customer, select];
}

export function useSimulatedStaff(): [SimulatedStaff, (id: string) => void] {
  const staff = useSyncExternalStore(staffStore.subscribe, staffStore.read, () => staffStore.fallback);
  const select = useCallback((id: string) => staffStore.select(id), []);
  return [staff, select];
}
