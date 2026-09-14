import type { NextConfig } from "next";

// The browser talks to the API through the web origin (/api/*) so no CORS or origin juggling is needed
// in the customer or staff UI. API_ORIGIN points to the NestJS server (docs/runbooks/VERIFICATION.md).
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
