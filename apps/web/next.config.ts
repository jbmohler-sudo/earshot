import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@earshot/core", "@earshot/sources", "@earshot/zone-metal", "@earshot/zone-indie", "@earshot/zone-folk", "@earshot/zone-outskirts"],
};

export default nextConfig;
