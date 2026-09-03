import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Images are small local brand assets; keep default optimizer settings.
  // Replit runs behind a proxy — allow its dev origin to reach the dev server.
  allowedDevOrigins: ["*.replit.dev", "*.repl.co"],
};

export default nextConfig;
