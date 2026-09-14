import { OrbitShell } from "@/features/shell/OrbitShell";

/**
 * Orbit does not exist yet (DEC-0003), so this page stands in for the trading interface that will host the
 * "Suporte" entrypoint: a labeled, simulated shell with the support panel placed as a side panel on desktop
 * and a full-screen view on mobile (PROJECT_CONTEXT.md §4.1).
 */
export default function Home() {
  return <OrbitShell />;
}
