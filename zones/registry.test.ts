// Genre mapper: real-ish Last.fm top tags through every zone's claims().
import { pickZone } from "../packages/core/src/index.ts";
import { describe, expect, it } from "vitest";
import { CLAIMING_ZONES, FALLBACK_ZONE_ID } from "./registry.ts";

const map = (tags: [string, number][]) =>
  pickZone(
    tags.map(([name, count]) => ({ name, count })),
    CLAIMING_ZONES,
    FALLBACK_ZONE_ID,
  ).zoneId;

describe("genre mapper", () => {
  it("puts thrash into Metal", () => {
    expect(map([["thrash metal", 100], ["metal", 71], ["heavy metal", 50], ["hard rock", 20], ["seen live", 10]])).toBe("metal");
  });
  it("puts shoegaze/dream pop into Indie", () => {
    expect(map([["shoegaze", 100], ["dream pop", 80], ["indie", 40], ["alternative", 30], ["female vocalists", 20]])).toBe("indie");
  });
  it("puts americana into Folk", () => {
    expect(map([["folk", 100], ["americana", 60], ["singer-songwriter", 45], ["indie folk", 30], ["indie", 20]])).toBe("folk");
  });
  it("weights by count when tags straddle zones", () => {
    // indie 100+60 = 160 beats folk 90
    expect(map([["indie", 100], ["folk", 90], ["indie rock", 60]])).toBe("indie");
  });
  it("sends unclaimed genres to the Outskirts", () => {
    expect(map([["hip-hop", 100], ["rap", 80], ["seen live", 10]])).toBe("outskirts");
    expect(map([])).toBe("outskirts");
  });
});
