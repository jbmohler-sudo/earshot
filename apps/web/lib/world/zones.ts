import type { ZonePlugin } from "@earshot/core";
import { createZone as createMetal } from "@earshot/zone-metal";

/** Zones with a world to render. Indie, Folk and the Outskirts join in step 8. */
export const ZONES: Record<string, { name: string; create: () => ZonePlugin }> = {
  metal: { name: "The Forge · Metal", create: createMetal },
};

export const isZoneId = (id: string): boolean => Object.hasOwn(ZONES, id);
