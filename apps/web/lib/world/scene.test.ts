// Zone counts come only from presence rows. Ambient locals live on the zone plug-in and are drawn by
// the renderer; they can't reach a Scene, so "listening now", venue sizes and tiers never include them.
import { describe, expect, it } from "vitest";
import { type PresenceRecord, sceneFromPresence } from "./scene";
import { ZONES } from "./zones";

const row = (id: string, artist: string, spot: PresenceRecord["spot"], slot: number | null, index: number | null): PresenceRecord => ({
  user_id: id,
  zone_id: "folk",
  artist_key: artist.toLowerCase(),
  item_key: `${artist.toLowerCase()}|song`,
  spot,
  slot,
  spot_index: index,
  artist_name: artist,
  title: "Song",
  display_name: id,
  avatar: {},
});

describe("zone counts ignore ambient locals", () => {
  it("every zone has locals, yet a scene holds exactly the presence rows", () => {
    for (const [id, z] of Object.entries(ZONES)) expect(z.create().locals?.length, id).toBeGreaterThan(0);

    const rows = [row("a", "Fleet Foxes", "stage", 0, 0), row("b", "Fleet Foxes", "field", 0, 0), row("c", "Bon Iver", "stage", 1, 0)];
    const scene = sceneFromPresence(rows, null);
    const localIds = new Set(ZONES.folk!.create().locals!.map((l) => l.id));

    expect(scene.people.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(scene.venues.reduce((s, v) => s + v.count, 0)).toBe(3); // what "listening now" shows
    expect(scene.venues.find((v) => v.groupKey === "fleet foxes")).toMatchObject({ count: 2, tier: "tavern" });
    expect(scene.people.some((p) => localIds.has(p.id))).toBe(false);
  });

  it("an empty zone is empty, locals or not", () => {
    const scene = sceneFromPresence([], null);
    expect(scene.people).toHaveLength(0);
    expect(scene.venues).toHaveLength(0);
  });
});
