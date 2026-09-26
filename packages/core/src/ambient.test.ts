import { describe, expect, it } from "vitest";
import { localsToShow } from "./ambient.ts";

describe("localsToShow", () => {
  it("shows about 6 in an empty zone, 2 at 10 people, none at festival size", () => {
    expect(localsToShow(0, 6)).toBe(6);
    expect(localsToShow(5, 6)).toBe(4);
    expect(localsToShow(10, 6)).toBe(2);
    expect(localsToShow(30, 6)).toBe(1);
    expect(localsToShow(50, 6)).toBe(0);
    expect(localsToShow(200, 6)).toBe(0);
  });
  it("never increases as people arrive", () => {
    let prev = Infinity;
    for (let n = 0; n <= 60; n++) {
      const k = localsToShow(n, 6);
      expect(k).toBeLessThanOrEqual(prev);
      prev = k;
    }
  });
  it("is capped by how many locals the zone has", () => {
    expect(localsToShow(0, 4)).toBe(4);
    expect(localsToShow(0, 0)).toBe(0);
  });
});
