// The genre mapper: every zone that claims tags, the fallback, the mapping policy, and contributor
// overrides (artist key -> zone id), and every zone's layout. Imported by the poller (Deno), scripts
// and tests, so only pure-data claims.ts and layout.ts files belong here, never renderers.
import type { ZoneLayout } from "../packages/core/src/contracts.ts";
import { pickZone, type ZonePick, type WeightedTag } from "../packages/core/src/zones.ts";
import { layout as folkLayout } from "./folk/src/layout.ts";
import { layout as indieLayout } from "./indie/src/layout.ts";
import { layout as metalLayout } from "./metal/src/layout.ts";
import { layout as outskirtsLayout } from "./outskirts/src/layout.ts";
import * as folk from "./folk/src/claims.ts";
import * as indie from "./indie/src/claims.ts";
import * as metal from "./metal/src/claims.ts";
import * as outskirts from "./outskirts/src/claims.ts";
import overrides from "./overrides.json" with { type: "json" };

export const CLAIMING_ZONES = [metal, indie, folk];
export const FALLBACK_ZONE_ID = outskirts.id;
export const ZONE_IDS = [metal.id, indie.id, folk.id, outskirts.id];
export const OVERRIDES: Record<string, string> = overrides;

/** Every zone's layout (pure data), for server-side presence layout. */
export const LAYOUTS: Record<string, ZoneLayout> = {
  [metal.id]: metalLayout,
  [indie.id]: indieLayout,
  [folk.id]: folkLayout,
  [outskirts.id]: outskirtsLayout,
};

/** A zone must hold at least this share of an artist's weighted tags, or the artist goes to the Outskirts. */
export const MIN_CONFIDENCE = 0.35;

/**
 * Cross-genre tags that say little on their own. They still add to a zone's score, but can't win it one.
 * Weight 0 drops a tag entirely (it says nothing about genre).
 */
export const TAG_WEIGHTS: Record<string, number> = {
  alternative: 0.25,
  rock: 0.25,
  pop: 0.25,
  "seen live": 0,
  favorites: 0,
  favourites: 0,
};

export function mapTags(tags: readonly WeightedTag[]): ZonePick {
  return pickZone(tags, CLAIMING_ZONES, FALLBACK_ZONE_ID, { minConfidence: MIN_CONFIDENCE, tagWeights: TAG_WEIGHTS });
}
