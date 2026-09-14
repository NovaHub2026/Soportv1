"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * SIMULATED customer session. Orbit has no accounts yet (DEC-0003); the UI lets a developer pick which
 * fictional customer the browser acts as. The choice is remembered per browser and always labeled.
 */
export interface SimulatedCustomer {
  id: string;
  name: string;
}

export const SIMULATED_CUSTOMERS: readonly SimulatedCustomer[] = [
  { id: "cust-alice", name: "Alice Souza" },
  { id: "cust-bruno", name: "Bruno Lima" },
  { id: "cust-carla", name: "Carla Mendes" },
];

const STORAGE_KEY = "orbit-support.simulated-customer";
const CHANGE_EVENT = "orbit-support:simulated-customer-changed";

function readStored(): SimulatedCustomer {
  try {
    const id = window.localStorage.getItem(STORAGE_KEY);
    return SIMULATED_CUSTOMERS.find((c) => c.id === id) ?? SIMULATED_CUSTOMERS[0];
  } catch {
    return SIMULATED_CUSTOMERS[0];
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useSimulatedCustomer(): [SimulatedCustomer, (id: string) => void] {
  const customer = useSyncExternalStore(subscribe, readStored, () => SIMULATED_CUSTOMERS[0]);
  const select = useCallback((id: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage unavailable (private mode): the selection simply does not persist.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [customer, select];
}
