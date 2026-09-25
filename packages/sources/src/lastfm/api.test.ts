import { describe, expect, it, vi } from "vitest";
import { getNowPlaying, getTopTags, LastfmError, parseNowPlaying, parseTopTags } from "./api.ts";

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
