import { describe, expect, it } from "vitest";
import { tierOf } from "./tiers";

describe("tierOf", () => {
  it.each([
    [1, "busker"],
    [2, "tavern"],
    [9, "tavern"],
    [10, "amph"],
    [49, "amph"],
    [50, "fest"],
    [500, "fest"],
  ] as const)("%i listeners -> %s", (n, tier) => {
    expect(tierOf(n)).toBe(tier);
  });
});
