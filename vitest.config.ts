import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // apps/web's "@/..." import alias (tsconfig paths), for web-side unit tests.
    alias: { "@": fileURLToPath(new URL("./apps/web", import.meta.url)) },
  },
  test: {
    include: ["{packages,zones,apps}/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
