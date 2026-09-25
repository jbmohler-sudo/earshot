import { describe, expect, it } from "vitest";
import type { ZoneLayout } from "./contracts.ts";
import { makeIso } from "./iso.ts";
import { type Participant, pickStageItem, spotFor, TIER_RADIUS, World } from "./world.ts";

const layout: ZoneLayout = {
  size: 32,
  pixels: { w: 512, h: 346 },
  origin: { x: 256, y: 70 },
  slots: [[9, 9], [23, 6], [5, 22]],
  plaza: { x0: 1.6, x1: 5.6, y0: 8.4, y1: 12.6 },
  bounds: { x0: 0.7, x1: 31.3, y0: 3.2, y1: 31.3 },
  spawnEdges: [{ from: [31.6, 4], to: [31.6, 31] }],
  focus: [12.5, 12.5],
};

/** n people in group g; `items` cycles through item keys. */
function crowd(g: string, n: number, items: string[] = ["a"], prefix = g): Participant[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, groupKey: g, itemKey: items[i % items.length]! }));
}

describe("iso", () => {
  it("projects tiles to 16×8 diamonds", () => {
    const iso = makeIso({ x: 256, y: 70 });
    expect(iso(0, 0)).toEqual([256, 70]);
    expect(iso(1, 0)).toEqual([264, 74]);
    expect(iso(0, 1)).toEqual([248, 74]);
    expect(iso(3, 2)).toEqual([264, 90]);
  });
});

describe("World: tiers and slots", () => {
  it("assigns tiers from counts", () => {
    const w = new World(layout);
    w.update([...crowd("a", 60), ...crowd("b", 12), ...crowd("c", 3)], true);
    expect(w.venues.get("a")!.tier).toBe("fest");
    expect(w.venues.get("b")!.tier).toBe("amph");
    expect(w.venues.get("c")!.tier).toBe("tavern");
    w.update(crowd("a", 1));
    expect(w.venues.get("a")!.tier).toBe("busker");
  });

  it("gives the biggest group slot 0 on first load", () => {
    const w = new World(layout);
    w.update([...crowd("small", 3), ...crowd("big", 20)], true);
    expect(w.venues.get("big")!.slot).toBe(0);
    expect(w.venues.get("small")!.slot).toBe(1);
  });

  it("keeps slot 0 unless the challenger beats owner × 1.15 + 1", () => {
    const w = new World(layout);
    w.update([...crowd("a", 20), ...crowd("b", 10)], true);
    expect(w.venues.get("a")!.slot).toBe(0);
    // 24 is not > 20 × 1.15 + 1 = 24
    w.update([...crowd("a", 20), ...crowd("b", 24)]);
    expect(w.venues.get("a")!.slot).toBe(0);
    // 25 is
    w.update([...crowd("a", 20), ...crowd("b", 25)]);
    expect(w.venues.get("b")!.slot).toBe(0);
    expect(w.venues.get("a")!.slot).toBe(1); // swapped into the challenger's old slot
  });

  it("parks unslotted groups in the plaza, and evicts the weakest only when clearly beaten", () => {
    const w = new World(layout); // 3 slots
    w.update([...crowd("a", 10), ...crowd("b", 6), ...crowd("c", 5), ...crowd("d", 4)], true);
    // 3 slots for 4 groups: the smallest waits in the plaza
    expect(w.venues.get("d")!.slot).toBe(-1);
    expect(w.placement("d0")).toMatchObject({ kind: "plaza", target: null });
    // d grows to 7: not > c (5) + 2, so still waiting
    w.update([...crowd("a", 10), ...crowd("b", 6), ...crowd("c", 5), ...crowd("d", 7)]);
    expect(w.venues.get("d")!.slot).toBe(-1);
    // d grows to 8 > 5 + 2 → evicts c, the weakest slotted group
    w.update([...crowd("a", 10), ...crowd("b", 6), ...crowd("c", 5), ...crowd("d", 8)]);
    expect(w.venues.get("d")!.slot).toBeGreaterThan(0);
    expect(w.venues.get("c")!.slot).toBe(-1);
    expect(w.placement("c0")!.kind).toBe("plaza");
  });

  it("frees a slot when its group empties", () => {
    const w = new World(layout);
    w.update([...crowd("a", 5), ...crowd("b", 2)], true);
    w.update(crowd("a", 5));
    expect(w.venues.get("b")).toMatchObject({ count: 0, slot: -1, stageItem: null });
    expect(w.slotOf(1)).toBeNull();
  });
});

describe("stage item", () => {
  it("is the most-shared item", () => {
    expect(pickStageItem(new Map([["x", 2], ["y", 5]]), null)).toBe("y");
  });
  it("keeps the incumbent on ties", () => {
    expect(pickStageItem(new Map([["x", 3], ["y", 3]]), "y")).toBe("y");
    expect(pickStageItem(new Map([["x", 3], ["y", 3]]), "x")).toBe("x");
  });
  it("puts people on the stage item in the front rows, everyone else in the field", () => {
    const w = new World(layout);
    w.update(crowd("a", 6, ["one", "one", "two"]), true);
    expect(w.venues.get("a")!.stageItem).toBe("one");
    expect(w.placement("a0")!.kind).toBe("front");
    expect(w.placement("a2")!.kind).toBe("field");
  });
});

describe("persistent spot indices", () => {
  it("keeps a person's index while others come and go; arrivals fill holes", () => {
    const w = new World(layout);
    const people = crowd("a", 5);
    w.update(people, true);
    const before = Object.fromEntries(people.map((p) => [p.id, w.placement(p.id)!.index]));
    // a1 leaves: everyone else keeps their index, and their exact spot
    const spotA3 = w.placement("a3")!.target;
    w.update(people.filter((p) => p.id !== "a1"));
    for (const id of ["a0", "a2", "a3", "a4"]) expect(w.placement(id)!.index).toBe(before[id]);
    expect(w.placement("a3")!.target).toEqual(spotA3);
    // a newcomer takes the hole a1 left
    w.update([...people.filter((p) => p.id !== "a1"), { id: "new", groupKey: "a", itemKey: "a" }]);
    expect(w.placement("new")!.index).toBe(before.a1);
  });

  it("re-seats someone who switches from the front rows to the field", () => {
    const w = new World(layout);
    w.update(crowd("a", 4, ["one", "one", "one", "two"]), true);
    expect(w.placement("a0")!.kind).toBe("front");
    w.update([{ id: "a0", groupKey: "a", itemKey: "two" }, ...crowd("a", 4, ["one", "one", "one", "two"]).slice(1)]);
    expect(w.placement("a0")!.kind).toBe("field");
  });
});

describe("spotFor", () => {
  it("spreads a crowd in a half-disk facing the viewer, beyond the tier's inner radius", () => {
    const at = [16, 16] as const;
    for (let i = 0; i < 40; i++) {
      const [x, y] = spotFor(at, "amph", "front", i, 0, layout.bounds);
      const dx = x - at[0];
      const dy = y - at[1];
      expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(TIER_RADIUS.amph - 1e-9);
      // facing +x+y (toward the viewer): angle within π/4 ± 1.1 rad
      const a = Math.atan2(dy, dx);
      expect(Math.abs(a - Math.PI / 4)).toBeLessThanOrEqual(1.1 + 1e-9);
    }
  });
  it("puts the field behind the front rows", () => {
    const front = spotFor([16, 16], "tavern", "front", 0, 0, layout.bounds);
    const field = spotFor([16, 16], "tavern", "field", 0, 0, layout.bounds);
    expect(Math.hypot(field[0] - 16, field[1] - 16)).toBeGreaterThan(Math.hypot(front[0] - 16, front[1] - 16));
  });
  it("stays inside the walkable bounds", () => {
    const [x, y] = spotFor([30, 30], "fest", "field", 30, 0.2, layout.bounds);
    expect(x).toBeLessThanOrEqual(layout.bounds.x1);
    expect(y).toBeLessThanOrEqual(layout.bounds.y1);
  });
});
