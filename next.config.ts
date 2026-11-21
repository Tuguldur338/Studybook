import type { NextConfig } from "next";

const isCapacitorBuild = process.env.CAPACITOR_BUILD === "1";

const nextConfig: NextConfig = {
  /* config options here */
  ...(isCapacitorBuild ? { output: "export", trailingSlash: true } : {}),
  ...(!isCapacitorBuild
    ? {
        rewrites: async () => [
          {
            source: "/teacher/:username",
            destination: "/teacher?username=:username",
          },
        ],
      }
    : {}),
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
