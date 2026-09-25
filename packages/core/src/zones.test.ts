import { describe, expect, it } from "vitest";
import { matchTags, normalizeTag, pickZone } from "./zones.ts";

const a = { id: "a", claims: matchTags(["alpha", "alpha beta", "lo-fi"]) };
const b = { id: "b", claims: matchTags(["beta", "gamma"]) };

describe("normalizeTag / matchTags", () => {
  it("ignores case, hyphens and extra spaces", () => {
    expect(normalizeTag("  Lo-Fi ")).toBe("lo fi");
    expect(a.claims(["LO FI", "lofi", "Alpha  Beta"])).toBe(2);
  });
});

describe("pickZone", () => {
  it("weights by tag count; highest total wins", () => {
    const pick = pickZone(
      [
        { name: "beta", count: 100 },
        { name: "alpha", count: 60 },
        { name: "alpha beta", count: 50 },
        { name: "other", count: 40 },
      ],
      [a, b],
      "fallback",
    );
    expect(pick.zoneId).toBe("a");
    expect(pick.scores).toEqual({ a: 110, b: 100 });
    expect(pick.confidence).toBeCloseTo(110 / 250);
  });

  it("falls back when no zone claims anything", () => {
    expect(pickZone([{ name: "other", count: 100 }], [a, b], "fallback")).toMatchObject({ zoneId: "fallback", confidence: 0 });
    expect(pickZone([], [a, b], "fallback").zoneId).toBe("fallback");
  });

  it("breaks ties in zone order", () => {
    expect(pickZone([{ name: "alpha", count: 10 }, { name: "beta", count: 10 }], [a, b], "f").zoneId).toBe("a");
    expect(pickZone([{ name: "alpha", count: 10 }, { name: "beta", count: 10 }], [b, a], "f").zoneId).toBe("b");
  });
});
