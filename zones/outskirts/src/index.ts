// The Outskirts: a desert roadside at night, where everything no other zone claims plays. Placeholder art.
import type { ZonePlugin } from "@earshot/core";
import { claims, id } from "./claims.ts";
import { layout } from "./layout.ts";
import { createLocals } from "./locals.ts";
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
    emotes: [{ id: "wave", label: "Wave" }],
    locals: createLocals(),
    theme: { name: "The Outskirts", background: "#0d0b10", accent: "#4fd1e0" },
  };
}
