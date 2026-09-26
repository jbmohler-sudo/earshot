// The Folk zone: The Hollow, a forest clearing by a creek. Placeholder art.
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
    emotes: [{ id: "stomp", label: "Stomp" }],
    locals: createLocals(),
    theme: { name: "The Hollow", background: "#0a100b", accent: "#e8b04a" },
  };
}
