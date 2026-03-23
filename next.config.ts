import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@bridge-tools/dd", "@bridge-tools/core"],
  outputFileTracingIncludes: {
    "/api/dds": ["./dds-worker.js", "./node_modules/@bridge-tools/**/*"],
    "/api/best-lead": ["./dds-worker.js", "./node_modules/@bridge-tools/**/*"],
    "/api/play-analysis": ["./dds-worker.js", "./node_modules/@bridge-tools/**/*"],
  },
};

export default nextConfig;
