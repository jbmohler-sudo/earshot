// Genre mapper: real-shaped Last.fm top tags through the full mapping policy.
import { describe, expect, it } from "vitest";
import { MIN_CONFIDENCE, mapTags } from "./registry.ts";

const map = (tags: [string, number][]) => mapTags(tags.map(([name, count]) => ({ name, count })));

describe("genre mapper", () => {
  it("puts thrash into Metal", () => {
    expect(map([["thrash metal", 100], ["metal", 71], ["heavy metal", 50], ["hard rock", 20], ["seen live", 10]]).zoneId).toBe("metal");
  });
  it("puts shoegaze/dream pop into Indie", () => {
    expect(map([["shoegaze", 100], ["dream pop", 80], ["indie", 40], ["alternative", 30], ["female vocalists", 20]]).zoneId).toBe("indie");
  });
  it("puts americana into Folk", () => {
    expect(map([["folk", 100], ["americana", 60], ["singer-songwriter", 45], ["indie folk", 30], ["indie", 20]]).zoneId).toBe("folk");
  });
  it("keeps Arctic Monkeys in Indie despite the generic tags", () => {
    const pick = map([
      ["indie", 100], ["indie rock", 84], ["rock", 58], ["alternative", 34], ["british", 32],
      ["alternative rock", 16], ["garage rock", 12], ["post-punk revival", 8], ["seen live", 7], ["britpop", 5],
    ]);
    expect(pick.zoneId).toBe("indie");
    expect(pick.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
  });
  it("weights by count when tags straddle zones", () => {
    // indie 100+60 = 160 beats folk 90
    expect(map([["indie", 100], ["folk", 90], ["indie rock", 60]]).zoneId).toBe("indie");
  });

  describe("until a hip-hop zone exists, hip-hop goes to the Outskirts", () => {
    it("Beastie Boys: 'alternative' and 'rock' can't carry them into Indie", () => {
      const pick = map([
        ["Hip-Hop", 100], ["rap", 66], ["old school", 30], ["alternative", 25], ["hip hop", 22],
        ["90s", 14], ["rock", 12], ["funk", 9], ["east coast rap", 7], ["seen live", 6],
      ]);
      expect(pick.zoneId).toBe("outskirts");
    });
    it("plain hip-hop/rap", () => {
      expect(map([["hip-hop", 100], ["rap", 80], ["seen live", 10]]).zoneId).toBe("outskirts");
    });
  });

  it("generic tags alone never pick a zone", () => {
    expect(map([["alternative", 100], ["rock", 90]]).zoneId).toBe("outskirts");
  });
  it("a weak genre match below the threshold goes to the Outskirts", () => {
    const pick = map([["electronic", 100], ["house", 80], ["indie", 30]]);
    expect(pick.zoneId).toBe("outskirts");
    expect(pick.bestShare).toBeLessThan(MIN_CONFIDENCE);
  });
  it("no tags at all goes to the Outskirts", () => {
    expect(map([]).zoneId).toBe("outskirts");
  });
});
