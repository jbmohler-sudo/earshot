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
