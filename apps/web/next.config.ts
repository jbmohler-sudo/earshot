import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@earshot/core", "@earshot/sources", "@earshot/zone-metal", "@earshot/zone-indie", "@earshot/zone-folk", "@earshot/zone-outskirts"],
  // Zones live at the top level (earshot.world/metal). Old /z/<zone> links keep working, forever.
  async redirects() {
    return [{ source: "/z/:zone", destination: "/:zone", permanent: true }];
  },
};

export default nextConfig;
