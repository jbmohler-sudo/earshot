import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@earshot/core", "@earshot/sources"],
};

export default nextConfig;
