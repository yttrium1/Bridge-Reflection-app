import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@bridge-tools/dd", "@bridge-tools/core"],
  outputFileTracingIncludes: {
    "/api/dds": ["./dds-worker-cli.js", "./node_modules/@bridge-tools/**/*"],
    "/api/best-lead": ["./dds-worker-cli.js", "./node_modules/@bridge-tools/**/*"],
    "/api/play-analysis": ["./dds-worker-cli.js", "./node_modules/@bridge-tools/**/*"],
  },
};

export default nextConfig;
