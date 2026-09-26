import { describe, expect, it } from "vitest";
import type { ZoneLayout } from "./contracts.ts";
import { type LayoutParticipant, type LayoutStore, type PresenceRow, syncPresence } from "./presence-sync.ts";
import { World, type WorldSnapshot } from "./world.ts";

const layout = (slots: [number, number][]): ZoneLayout => ({
  size: 32,
  pixels: { w: 512, h: 346 },
  origin: { x: 256, y: 70 },
  slots,
  plaza: { x0: 1.6, x1: 5.6, y0: 8.4, y1: 12.6 },
  bounds: { x0: 0.7, x1: 31.3, y0: 3.2, y1: 31.3 },
  spawnEdges: [{ from: [31.6, 4], to: [31.6, 31] }],
  focus: [12.5, 12.5],
});
const LAYOUTS = { a: layout([[9, 9], [23, 6]]), b: layout([[9, 9], [23, 6]]), fallback: layout([[9, 9]]) };

const person = (id: string, zoneId: string, groupKey: string, itemKey = "x", name = id): LayoutParticipant => ({
  id,
  zoneId,
  groupKey,
  itemKey,
  display: { name },
});

function memoryStore(initial: LayoutParticipant[]) {
  let participants = initial;
  const states = new Map<string, WorldSnapshot>();
  const presence = new Map<string, PresenceRow>();
  const log: string[] = [];
  const store: LayoutStore = {
    loadParticipants: async () => participants,
    loadStates: async () => new Map([...states].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
    saveState: async (z, s) => void states.set(z, JSON.parse(JSON.stringify(s))),
    loadPresence: async () => [...presence.values()].map((r) => structuredClone(r)),
    deletePresence: async (ids) => {
      for (const id of ids) {
        presence.delete(id);
        log.push(`delete ${id}`);
      }
    },
    upsertPresence: async (rows) => {
      for (const r of rows) {
        presence.set(r.userId, structuredClone(r));
        log.push(`upsert ${r.userId}`);
      }
    },
  };
  return { store, presence, states, log, set: (p: LayoutParticipant[]) => void (participants = p) };
}

describe("World snapshots", () => {
  it("round-trips slot owners, stage items and spot indices through JSON", () => {
    const people = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, groupKey: i < 4 ? "big" : "small", itemKey: "s" }));
    const w1 = new World(LAYOUTS.a);
    w1.update(people, true);
    w1.update(people.filter((p) => p.id !== "p1")); // leaves a hole at p1's index

    const w2 = World.fromJSON(LAYOUTS.a, JSON.parse(JSON.stringify(w1.toJSON())));
    w2.update(people.filter((p) => p.id !== "p1"));
    for (const p of people.filter((p) => p.id !== "p1")) {
      expect(w2.placement(p.id)).toMatchObject({ kind: w1.placement(p.id)!.kind, index: w1.placement(p.id)!.index, slot: w1.placement(p.id)!.slot });
    }
    // A newcomer fills p1's hole after the "restart", exactly as it would have before.
    w2.update([...people.filter((p) => p.id !== "p1"), { id: "new", groupKey: "big", itemKey: "s" }]);
    expect(w2.placement("new")!.index).toBe(1);
  });

  it("keeps slot-0 hysteresis across a restart", () => {
    const w1 = new World(LAYOUTS.a);
    const crowd = (g: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${g}${i}`, groupKey: g, itemKey: "s" }));
    w1.update([...crowd("owner", 20), ...crowd("challenger", 10)], true);
    const w2 = World.fromJSON(LAYOUTS.a, w1.toJSON());
    w2.update([...crowd("owner", 20), ...crowd("challenger", 24)]); // not enough to take slot 0
    expect(w2.venues.get("owner")!.slot).toBe(0);
  });
});

describe("syncPresence", () => {
  it("writes a presence row per participant, with stage/field/plaza, slot and index", async () => {
    const m = memoryStore([person("u1", "a", "g1", "hit"), person("u2", "a", "g1", "hit"), person("u3", "a", "g1", "deep cut")]);
    const stats = await syncPresence(m.store, LAYOUTS, "fallback");
    expect(stats).toMatchObject({ participants: 3, upserted: 3, deleted: 0, statesSaved: 3 });
    expect(m.presence.get("u1")).toMatchObject({ zoneId: "a", spot: "stage", slot: 0, spotIndex: 0, display: { name: "u1" } });
    expect(m.presence.get("u3")).toMatchObject({ spot: "field", slot: 0, spotIndex: 0 });
  });

  it("writes nothing when nothing changed", async () => {
    const m = memoryStore([person("u1", "a", "g1"), person("u2", "b", "g2")]);
    await syncPresence(m.store, LAYOUTS, "fallback");
    m.log.length = 0;
    const stats = await syncPresence(m.store, LAYOUTS, "fallback");
    expect(stats).toMatchObject({ upserted: 0, deleted: 0, statesSaved: 0 });
    expect(m.log).toEqual([]);
  });

  it("moves someone between zones as delete then insert", async () => {
    const m = memoryStore([person("u1", "a", "g1")]);
    await syncPresence(m.store, LAYOUTS, "fallback");
    m.log.length = 0;
    m.set([person("u1", "b", "g2")]);
    const stats = await syncPresence(m.store, LAYOUTS, "fallback");
    expect(stats.moved).toBe(1);
    expect(m.log).toEqual(["delete u1", "upsert u1"]);
    expect(m.presence.get("u1")!.zoneId).toBe("b");
  });

  it("deletes people who left (stale or hidden) and updates changed display fields", async () => {
    const m = memoryStore([person("u1", "a", "g1"), person("u2", "a", "g1")]);
    await syncPresence(m.store, LAYOUTS, "fallback");
    m.log.length = 0;
    m.set([person("u1", "a", "g1", "x", "renamed")]);
    await syncPresence(m.store, LAYOUTS, "fallback");
    expect(m.log).toEqual(["delete u2", "upsert u1"]);
    expect(m.presence.get("u1")!.display).toEqual({ name: "renamed" });
  });

  it("sends unknown zones to the fallback", async () => {
    const m = memoryStore([person("u1", "nowhere", "g1")]);
    await syncPresence(m.store, LAYOUTS, "fallback");
    expect(m.presence.get("u1")!.zoneId).toBe("fallback");
  });

  it("parks groups without a free slot in the plaza with no slot or index", async () => {
    const m = memoryStore([person("u1", "fallback", "g1"), person("u2", "fallback", "g1"), person("u3", "fallback", "g2")]);
    await syncPresence(m.store, LAYOUTS, "fallback"); // fallback has 1 slot
    expect(m.presence.get("u3")).toMatchObject({ spot: "plaza", slot: null, spotIndex: null });
  });
});
