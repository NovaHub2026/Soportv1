import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without globals here, so Testing Library cannot register its own cleanup.
afterEach(() => cleanup());

// jsdom has no object URLs; attachments create them for fetched blobs.
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => `blob:mock-${Math.random().toString(36).slice(2)}`;
  URL.revokeObjectURL = () => {};
}
