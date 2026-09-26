import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_PATHS, ZONES } from "./zones";

const APP_DIR = join(__dirname, "..", "..", "app");
/** Top-level static segments that exist as folders or files in app/ (route groups and dynamic segments excluded). */
const pageSegments = readdirSync(APP_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("[") && !d.name.startsWith("("))
  .map((d) => d.name);

describe("zone URLs share the top-level namespace with pages", () => {
  const zoneIds = Object.keys(ZONES);

  it("zone ids are lowercase URL-safe genre ids", () => {
    for (const id of zoneIds) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it("no zone id is a reserved path", () => {
    for (const id of zoneIds) expect(RESERVED_PATHS as readonly string[]).not.toContain(id);
  });

  it("no page folder in app/ takes a zone id", () => {
    for (const seg of pageSegments) expect(zoneIds, `app/${seg} collides with a zone`).not.toContain(seg);
  });

  it("every page folder in app/ is listed as reserved (so new pages get noticed here)", () => {
    for (const seg of pageSegments) expect(RESERVED_PATHS as readonly string[], `add "${seg}" to RESERVED_PATHS`).toContain(seg);
  });
});
