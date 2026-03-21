import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@bridge-tools/dd", "@bridge-tools/core"],
  outputFileTracingIncludes: {
    "/api/dds": ["./dds-calc.js", "./node_modules/@bridge-tools/**/*"],
    "/api/best-lead": ["./best-lead-calc.js", "./node_modules/@bridge-tools/**/*"],
  },
};

export default nextConfig;
