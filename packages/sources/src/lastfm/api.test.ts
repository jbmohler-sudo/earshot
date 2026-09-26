import { describe, expect, it, vi } from "vitest";
import { getNowPlaying, getTopTags, LastfmError, parseNowPlaying, parseTopTags, songKey } from "./api.ts";

const track = (artist: string, name: string, nowplaying = false) => ({
  artist: { "#text": artist, mbid: "" },
  name,
  ...(nowplaying ? { "@attr": { nowplaying: "true" } } : { date: { uts: "1" } }),
});

describe("parseNowPlaying", () => {
  it("finds the now-playing track among recent tracks", () => {
    const np = parseNowPlaying({ recenttracks: { track: [track("Metallica", "One", true), track("Slayer", "Angel of Death")] } });
    expect(np).toEqual({ artist: "Metallica", title: "One", artistKey: "metallica", itemKey: "metallica|one" });
  });
  it("handles a single track object", () => {
    expect(parseNowPlaying({ recenttracks: { track: track("Ghost", "Square Hammer", true) } })?.artistKey).toBe("ghost");
  });
  it("returns null when nothing is playing now", () => {
    expect(parseNowPlaying({ recenttracks: { track: [track("Slayer", "Angel of Death")] } })).toBeNull();
    expect(parseNowPlaying({ recenttracks: { track: [] } })).toBeNull();
    expect(parseNowPlaying({})).toBeNull();
  });
  it("normalizes keys", () => {
    expect(parseNowPlaying({ recenttracks: { track: track("  Iron   MAIDEN ", "The Trooper", true) } })?.itemKey).toBe("iron maiden|the trooper");
  });
});

describe("parseTopTags", () => {
  it("keeps up to 10 tags with positive counts", () => {
    const tag = Array.from({ length: 12 }, (_, i) => ({ name: `t${i}`, count: 100 - i }));
    tag.push({ name: "zero", count: 0 });
    expect(parseTopTags({ toptags: { tag } })).toHaveLength(10);
    expect(parseTopTags({ toptags: { tag: { name: "folk", count: "100" } } })).toEqual([{ name: "folk", count: 100 }]);
  });
});

describe("errors", () => {
  it("maps HTTP 429 and Last.fm code 29 to rateLimited", async () => {
    const http429 = vi.fn(async () => new Response("slow down", { status: 429 }));
    await expect(getNowPlaying("u", "k", http429 as unknown as typeof fetch)).rejects.toMatchObject({ rateLimited: true });
    const code29 = vi.fn(async () => Response.json({ error: 29, message: "Rate limit exceeded" }));
    await expect(getNowPlaying("u", "k", code29 as unknown as typeof fetch)).rejects.toMatchObject({ code: 29, rateLimited: true });
  });
  it("returns no tags for an unknown artist", async () => {
    const notFound = vi.fn(async () => Response.json({ error: 6, message: "The artist you supplied could not be found" }));
    await expect(getTopTags("nobody", "k", notFound as unknown as typeof fetch)).resolves.toEqual([]);
  });
  it("surfaces other errors", async () => {
    const down = vi.fn(async () => Response.json({ error: 11, message: "Service Offline" }));
    await expect(getNowPlaying("u", "k", down as unknown as typeof fetch)).rejects.toBeInstanceOf(LastfmError);
  });
});

describe("songKey (stage-song grouping)", () => {
  const base = songKey("Master of Puppets");
  it.each([
    "Master Of Puppets (Remastered)",
    "Master of Puppets - Remastered 2008",
    "Master of Puppets - 2017 Remaster",
    "Master of Puppets [Remastered]",
    "Master of Puppets (Live)",
    "Master of Puppets - Live at Seattle 1989",
    "Master of Puppets (Deluxe)",
    "Master of Puppets (Deluxe Edition)",
    "Master of Puppets (Radio Edit)",
    "MASTER OF PUPPETS",
    "  Master   of Puppets  ",
    "Master of Puppets!",
    "Master of Puppets (Remastered) - Live",
  ])("%s → same song", (variant) => {
    expect(songKey(variant)).toBe(base);
  });

  it("drops featured artists in every spelling", () => {
    const k = songKey("Walk This Way");
    for (const v of ["Walk This Way (feat. Aerosmith)", "Walk This Way [ft. Aerosmith]", "Walk This Way feat. Aerosmith", "Walk This Way featuring Aerosmith", "Walk This Way - feat. Aerosmith", "Walk This Way (with Aerosmith)"]) {
      expect(songKey(v)).toBe(k);
    }
  });

  it("strips punctuation and apostrophes", () => {
    expect(songKey("Chop Suey!")).toBe("chop suey");
    expect(songKey("Holy Wars... The Punishment Due")).toBe("holy wars the punishment due");
    expect(songKey("(Don't Fear) The Reaper")).toBe("dont fear the reaper");
  });

  it("keeps words that only look like variants, and real differences", () => {
    expect(songKey("Live Forever")).toBe("live forever");
    expect(songKey("Alive")).toBe("alive");
    expect(songKey("Credit in the Straight World")).toBe("credit in the straight world");
    expect(songKey("Song - Part 2")).toBe("song part 2");
    expect(songKey("Enter Sandman")).not.toBe(songKey("Sad but True"));
    expect(songKey("Blue Monday '88")).not.toBe(songKey("Blue Monday"));
  });

  it("never returns an empty key", () => {
    expect(songKey("(Live)")).not.toBe("");
    expect(songKey("!!!")).not.toBe("");
  });

  it("groups remaster and original on the same stage via itemKey", () => {
    const np = (title: string) => parseNowPlaying({ recenttracks: { track: track("Metallica", title, true) } })!;
    expect(np("Master Of Puppets (Remastered)").itemKey).toBe(np("Master of Puppets").itemKey);
    expect(np("Master Of Puppets (Remastered)").title).toBe("Master Of Puppets (Remastered)"); // display unchanged
  });
});
