// The Metal zone: the Forge, ported from the Phase 0 prototype.
import type { ZonePlugin } from "@earshot/core";
import { claims, id } from "./claims.ts";
import { layout } from "./layout.ts";
import { createScenery } from "./scenery.ts";
import { createVenueStyles } from "./venues.ts";

export { claims, id, TAGS } from "./claims.ts";

/** A fresh plug-in instance (each keeps its own particle state). */
export function createZone(): ZonePlugin {
  return {
    id,
    kind: "music",
    claims,
    layout,
    venueStyles: createVenueStyles(),
    scenery: createScenery(),
    emotes: [{ id: "horns", label: "Horns up" }],
    theme: { name: "The Forge", background: "#0b0808", accent: "#ff6a2b" },
  };
}
