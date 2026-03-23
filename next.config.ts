import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@bridge-tools/dd", "@bridge-tools/core"],
  outputFileTracingIncludes: {
    "/api/dds": ["./node_modules/@bridge-tools/**/*"],
    "/api/best-lead": ["./node_modules/@bridge-tools/**/*"],
    "/api/play-analysis": ["./node_modules/@bridge-tools/**/*"],
  },
};

export default nextConfig;
