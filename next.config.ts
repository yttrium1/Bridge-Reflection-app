import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@bridge-tools/dd", "@bridge-tools/core"],
  outputFileTracingIncludes: {
    "/api/dds": ["./dds-worker-cli.js", "./node_modules/@bridge-tools/**/*"],
    "/api/best-lead": ["./dds-worker-cli.js", "./node_modules/@bridge-tools/**/*"],
    "/api/play-analysis": ["./dds-worker-cli.js", "./node_modules/@bridge-tools/**/*"],
  },
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("child_process", "fs", "path");
      }
    }
    return config;
  },
};

export default nextConfig;
