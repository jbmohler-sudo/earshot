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

  it("sends a winner below minConfidence to the fallback, reporting its share", () => {
    const tags = [{ name: "alpha", count: 30 }, { name: "other", count: 70 }];
    expect(pickZone(tags, [a, b], "f").zoneId).toBe("a");
    const pick = pickZone(tags, [a, b], "f", { minConfidence: 0.35 });
    expect(pick).toMatchObject({ zoneId: "f", confidence: 0 });
    expect(pick.bestShare).toBeCloseTo(0.3);
  });

  it("down-weights generic tags, which can't win a zone on their own", () => {
    const tagWeights = { beta: 0.25 };
    // beta alone: generic, so no anchor for b
    expect(pickZone([{ name: "beta", count: 100 }], [a, b], "f", { tagWeights }).zoneId).toBe("f");
    // gamma anchors b; beta adds only 25
    const pick = pickZone([{ name: "gamma", count: 10 }, { name: "beta", count: 100 }], [a, b], "f", { tagWeights });
    expect(pick.zoneId).toBe("b");
    expect(pick.scores.b).toBe(35);
    expect(pick.confidence).toBe(1); // total is weighted too: 10 + 25
  });

  it("ignores weight-0 tags entirely", () => {
    const pick = pickZone([{ name: "alpha", count: 50 }, { name: "noise", count: 50 }], [a, b], "f", { tagWeights: { noise: 0 } });
    expect(pick.confidence).toBe(1);
  });

  it("breaks ties in zone order", () => {
    expect(pickZone([{ name: "alpha", count: 10 }, { name: "beta", count: 10 }], [a, b], "f").zoneId).toBe("a");
    expect(pickZone([{ name: "alpha", count: 10 }, { name: "beta", count: 10 }], [b, a], "f").zoneId).toBe("b");
  });
});
