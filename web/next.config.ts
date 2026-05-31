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
};

export default nextConfig;
