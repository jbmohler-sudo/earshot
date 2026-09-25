// Every zone that claims tags, in tie-break order, plus contributor overrides (artist key -> zone id).
// Imported by the poller (Deno) and by tests, so only claims.ts files belong here.
import * as folk from "./folk/src/claims.ts";
import * as indie from "./indie/src/claims.ts";
import * as metal from "./metal/src/claims.ts";
import * as outskirts from "./outskirts/src/claims.ts";
import overrides from "./overrides.json" with { type: "json" };

export const CLAIMING_ZONES = [metal, indie, folk];
export const FALLBACK_ZONE_ID = outskirts.id;
export const ZONE_IDS = [metal.id, indie.id, folk.id, outskirts.id];
export const OVERRIDES: Record<string, string> = overrides;
