// The Indie zone: The Lot, a warehouse district at dusk. Placeholder art.
import type { ZonePlugin } from "@earshot/core";
import { claims, id } from "./claims.ts";
import { layout } from "./layout.ts";
import { createScenery } from "./scenery.ts";
import { createVenueStyles } from "./venues.ts";

export { claims, id, TAGS } from "./claims.ts";

export function createZone(): ZonePlugin {
  return {
    id,
    kind: "music",
    claims,
    layout,
    venueStyles: createVenueStyles(),
    scenery: createScenery(),
    emotes: [{ id: "sway", label: "Sway" }],
    theme: { name: "The Lot", background: "#0e0c14", accent: "#ff5fa2" },
  };
}
