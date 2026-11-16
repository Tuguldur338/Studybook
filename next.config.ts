import type { NextConfig } from "next";

const isCapacitorBuild = process.env.CAPACITOR_BUILD === "1";

const nextConfig: NextConfig = {
  /* config options here */
  ...(isCapacitorBuild ? { output: "export", trailingSlash: true } : {}),
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: !isCapacitorBuild,
  partialPrefetching: !isCapacitorBuild,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
