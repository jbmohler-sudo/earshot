import { describe, expect, it } from "vitest";
import { dottedPath, hopAt, LANDMARKS, MAP_H, MAP_W } from "./map";
import { FULL, hopProgress, phaseAt, REDUCED, timelineFor, travelMode } from "./travel";
import { ZONES } from "./zones";

describe("world map", () => {
  it("has an on-map landmark for every zone", () => {
    for (const id of Object.keys(ZONES)) {
      const L = LANDMARKS[id];
      expect(L, id).toBeDefined();
      expect(L!.x).toBeGreaterThan(10);
      expect(L!.x).toBeLessThan(MAP_W - 10);
      expect(L!.y).toBeGreaterThan(20);
      expect(L!.y).toBeLessThan(MAP_H - 5);
    }
  });
  it("dotted paths start and end on the landmarks", () => {
    const pts = dottedPath(LANDMARKS.folk!, LANDMARKS.metal!);
    expect(pts[0]).toEqual([LANDMARKS.folk!.x, LANDMARKS.folk!.y]);
    expect(pts.at(-1)).toEqual([LANDMARKS.metal!.x, LANDMARKS.metal!.y]);
  });
  it("hops lift off between landings and land exactly on the destination", () => {
    const a = LANDMARKS.folk!;
    const b = LANDMARKS.metal!;
    expect(hopAt(a, b, 0)).toMatchObject({ x: a.x, y: a.y, air: false });
    expect(hopAt(a, b, 1 / 8).air).toBe(true); // middle of the first of 4 hops
    expect(hopAt(a, b, 1)).toMatchObject({ x: b.x, y: b.y, air: false });
  });
});

describe("travel timeline", () => {
  it("runs about 2.5 s in order: walk, fade, map, title, go", () => {
    expect(FULL.go).toBeGreaterThanOrEqual(2300);
    expect(FULL.go).toBeLessThanOrEqual(2700);
    expect(["walk", "fade", "map", "title", "go"].map((p) => phaseAt(FULL, FULL[p as keyof typeof FULL]))).toEqual(["walk", "fade", "map", "title", "go"]);
    expect(hopProgress(FULL, FULL.map)).toBe(0);
    expect(hopProgress(FULL, FULL.title)).toBe(1);
  });
  it("reduced motion skips straight to the title card", () => {
    expect(timelineFor(true)).toBe(REDUCED);
    expect(phaseAt(REDUCED, 0)).toBe("title");
    expect(REDUCED.go).toBeLessThan(FULL.go);
  });
});

describe("travelMode", () => {
  it("plays the transition only for your own avatar while you follow it in the zone on screen", () => {
    expect(travelMode({ viewedZone: "folk", fromZone: "folk", toZone: "metal", followingSelf: true })).toBe("transition");
  });
  it("never hijacks the camera otherwise: a toast", () => {
    expect(travelMode({ viewedZone: "folk", fromZone: "folk", toZone: "metal", followingSelf: false })).toBe("toast");
    expect(travelMode({ viewedZone: "indie", fromZone: "folk", toZone: "metal", followingSelf: true })).toBe("toast");
    expect(travelMode({ viewedZone: "indie", fromZone: null, toZone: "metal", followingSelf: false })).toBe("toast");
  });
  it("stays quiet when nothing changed or you arrived where you're looking", () => {
    expect(travelMode({ viewedZone: "metal", fromZone: "metal", toZone: "metal", followingSelf: true })).toBe("none");
    expect(travelMode({ viewedZone: "metal", fromZone: "folk", toZone: "metal", followingSelf: false })).toBe("none");
  });
});
