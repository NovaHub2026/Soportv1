import type { ReactNode } from "react";

/** Marks the document so the broker's theme tokens apply (globals.css `html[data-embed="orbit"]`). */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <div data-embed="orbit" className="embed-root">
      {children}
    </div>
  );
}
