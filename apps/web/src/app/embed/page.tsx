import { EmbeddedSupport } from "@/features/embed/EmbeddedSupport";

/**
 * `/embed` — the customer panel as the broker's app mounts it in an iframe (PH-13.2, DEC-0046 d). The host posts
 * the customer's access token through `postMessage`; nothing is rendered for anyone before that. Styled with the
 * broker's dark tokens (`html[data-embed]`, globals.css).
 */
export default function EmbedPage() {
  return <EmbeddedSupport />;
}
