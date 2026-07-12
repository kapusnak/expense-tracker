import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained .next/standalone server for container deploys (Railway).
  output: "standalone",
};

export default nextConfig;
