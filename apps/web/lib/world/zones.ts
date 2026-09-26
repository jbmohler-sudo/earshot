import type { ZonePlugin } from "@earshot/core";
import { createZone as createFolk } from "@earshot/zone-folk";
import { createZone as createIndie } from "@earshot/zone-indie";
import { createZone as createMetal } from "@earshot/zone-metal";
import { createZone as createOutskirts } from "@earshot/zone-outskirts";
import { FOLK, INDIE, METAL, OUTSKIRTS } from "./sim-artists";
import type { SimArtist } from "./sim";

/** Every zone with a world to render. `sim` feeds the simulated crowd (?sim=N). */
export const ZONES: Record<string, { name: string; create: () => ZonePlugin; sim: SimArtist[] }> = {
  metal: { name: "The Forge · Metal", create: createMetal, sim: METAL },
  indie: { name: "The Lot · Indie", create: createIndie, sim: INDIE },
  folk: { name: "The Hollow · Folk", create: createFolk, sim: FOLK },
  outskirts: { name: "The Outskirts", create: createOutskirts, sim: OUTSKIRTS },
};

export const isZoneId = (id: string): boolean => Object.hasOwn(ZONES, id);

/**
 * Zones are served at the top level (earshot.world/<zone id>), so zone ids and page paths share one
 * namespace. These first segments belong to pages (or are held for likely ones) and can never be zone
 * ids; zone ids in turn must never be used for a page. lib/world/zones.test.ts enforces both.
 */
export const RESERVED_PATHS = [
  // pages and routes that exist
  "api", "auth", "login", "me", "world", "z",
  // held for later
  "about", "admin", "app", "help", "invite", "legal", "logout", "map", "privacy", "settings", "signup", "static", "terms", "u", "user", "users", "zone", "zones",
  // framework and well-known
  "_next", "favicon.ico", "robots.txt", "sitemap.xml", ".well-known",
] as const;

/** URL for a zone. The genre id is the URL; place names like "The Forge" are display only. */
export const zoneHref = (zoneId: string): string => `/${zoneId}`;
