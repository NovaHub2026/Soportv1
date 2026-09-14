import { EmbeddedSupport } from "@/features/embed/EmbeddedSupport";
import { allowedHostOrigins } from "@/features/embed/embed-protocol";

/** The allowed hosts are read at request time (`SUPPORT_EMBED_HOST_ORIGINS`), so a demo or a deployment sets them without a rebuild. */
export const dynamic = "force-dynamic";

/**
 * `/embed` — the customer panel as the broker's app mounts it in an iframe (PH-13.2, DEC-0046 d). The host posts
 * the customer's access token through `postMessage`; nothing is rendered for anyone before that. Styled with the
 * broker's dark tokens (`[data-embed="orbit"]`, globals.css).
 */
export default function EmbedPage() {
  return <EmbeddedSupport hostOrigins={allowedHostOrigins(process.env.SUPPORT_EMBED_HOST_ORIGINS)} />;
}
