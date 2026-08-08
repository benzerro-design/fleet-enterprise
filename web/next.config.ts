import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const webRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  /** Evită căi greșite în `.next/standalone` când există lockfile-uri în afara `web/`. */
  outputFileTracingRoot: webRoot,
  turbopack: {
    root: webRoot,
  },
  /** Servește `/uploads/...` din GCS (sau disc local) via API route — nu din filesystem ephemeral. */
  async rewrites() {
    return [
      {
        source: "/uploads/:kind/:file",
        destination: "/api/uploads/file/:kind/:file",
      },
    ];
  },
};

export default nextConfig;
