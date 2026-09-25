import { FAST_MS, matchTags, MINUTE, RateGate } from "@earshot/core";
import { describe, expect, it } from "vitest";
import { type ArtistZone, type DueAccount, type EngagementWrite, type PollerStore, runPollCycle } from "./poller.ts";

// ---- fake world: clock, Last.fm, store ---------------------------------------------------------

function world(accounts: number) {
  let t = Date.UTC(2026, 8, 25, 20, 0, 0);
  const clock = { now: () => t, sleep: async (ms: number) => void (t += ms), advance: (ms: number) => void (t += ms) };

  const playing = new Map<string, { artist: string; title: string } | null>();
  const requests: { at: number; method: string }[] = [];
  let rateLimitNext = 0;

  const fetchImpl = (async (input: URL | string) => {
    const u = new URL(String(input));
    const method = u.searchParams.get("method")!;
    requests.push({ at: t, method });
    t += 40; // network latency
    if (rateLimitNext > 0) {
      rateLimitNext--;
      return Response.json({ error: 29, message: "Rate limit exceeded" });
    }
    if (method === "user.getrecenttracks") {
      const np = playing.get(u.searchParams.get("user")!);
      const track = np ? [{ artist: { "#text": np.artist }, name: np.title, "@attr": { nowplaying: "true" } }] : [];
      return Response.json({ recenttracks: { track } });
    }
    if (method === "artist.gettoptags") {
      const artist = u.searchParams.get("artist")!;
      const tag = artist.startsWith("Metal") ? [{ name: "thrash metal", count: 100 }] : [{ name: "hip-hop", count: 100 }];
      return Response.json({ toptags: { tag } });
    }
    throw new Error(`unexpected ${method}`);
  }) as unknown as typeof fetch;

  const acct = new Map<string, { username: string; lastChangedAt: string | null; nextPollAt: number; lastError: string | null }>();
  const engagements = new Map<string, EngagementWrite & { startedAt: string }>();
  const artists = new Map<string, ArtistZone>();
  for (let i = 0; i < accounts; i++) {
    acct.set(`u${i}`, { username: `user${i}`, lastChangedAt: null, nextPollAt: t, lastError: null });
    playing.set(`user${i}`, null);
  }

  const store: PollerStore = {
    countAccounts: async () => acct.size,
    claimDue: async (limit, leaseSeconds) => {
      const due = [...acct.entries()].filter(([, a]) => a.nextPollAt <= t).sort((x, y) => x[1].nextPollAt - y[1].nextPollAt).slice(0, limit);
      return due.map(([userId, a]): DueAccount => {
        a.nextPollAt = t + leaseSeconds * 1000;
        const e = engagements.get(userId);
        return { userId, username: a.username, lastChangedAt: a.lastChangedAt, itemKey: e?.itemKey ?? null, lastSeenAt: e?.lastSeenAt ?? null };
      });
    },
    getArtist: async (k) => artists.get(k) ?? null,
    saveArtist: async (a) => void artists.set(a.artistKey, a),
    saveEngagement: async (e) => {
      const prev = engagements.get(e.userId);
      engagements.set(e.userId, { ...e, startedAt: e.startedAt ?? prev?.startedAt ?? e.lastSeenAt });
    },
    clearEngagement: async (userId) => void engagements.delete(userId),
    finishAccount: async (userId, u) => {
      const a = acct.get(userId)!;
      a.lastChangedAt = u.lastChangedAt;
      a.nextPollAt = Date.parse(u.nextPollAt);
      a.lastError = u.lastError;
    },
    releaseAccount: async (userId, next) => void (acct.get(userId)!.nextPollAt = Date.parse(next)),
  };

  const zones = [{ id: "metal", claims: matchTags(["thrash metal", "metal"]) }];
  const gate = new RateGate(4, clock.now, clock.sleep);
  const cycle = () => runPollCycle({ apiKey: "k", store, zones, fallbackZoneId: "outskirts", gate, now: clock.now, fetch: fetchImpl });

  /** Cron: a run starts every 30 s (runs finish within their 25 s budget, so they never overlap). */
  async function runFor(ms: number) {
    const end = t + ms;
    const stats = [];
    while (t < end) {
      const runStart = t;
      stats.push(await cycle());
      expect(t - runStart).toBeLessThan(30_000);
      t = runStart + 30_000;
    }
    return stats;
  }

  return { clock, playing, requests, acct, engagements, artists, runFor, cycle, rateLimit: (n: number) => void (rateLimitNext = n) };
}

/** Largest number of requests that started inside any 1-second window. */
function peakPerSecond(times: number[]): number {
  let peak = 0;
  for (let i = 0, j = 0; i < times.length; i++) {
    while (times[i]! - times[j]! >= 1000) j++;
    peak = Math.max(peak, i - j + 1);
  }
  return peak;
}

// ---- tests -------------------------------------------------------------------------------------

describe("runPollCycle", () => {
  it("records what people play and maps new artists once", async () => {
    const w = world(3);
    w.playing.set("user0", { artist: "Metallica", title: "One" });
    w.playing.set("user1", { artist: "Metallica", title: "Fade to Black" });
    w.playing.set("user2", { artist: "Kendrick Lamar", title: "DNA." });
    const stats = await w.cycle();

    expect(stats).toMatchObject({ polled: 3, playing: 3, changed: 3, tagLookups: 2, errors: 0 });
    expect(w.engagements.get("u0")).toMatchObject({ itemKey: "metallica|one", artist: "Metallica", tags: ["thrash metal"] });
    expect(w.artists.get("metallica")).toMatchObject({ zoneId: "metal", confidence: 1 });
    expect(w.artists.get("kendrick lamar")?.zoneId).toBe("outskirts");
  });

  it("keeps started_at while the same item plays, resets it on change", async () => {
    const w = world(1);
    w.playing.set("user0", { artist: "Metallica", title: "One" });
    await w.cycle();
    const started = w.engagements.get("u0")!.startedAt;
    w.clock.advance(FAST_MS);
    await w.cycle();
    expect(w.engagements.get("u0")!.startedAt).toBe(started);
    w.playing.set("user0", { artist: "Metallica", title: "Battery" });
    w.clock.advance(FAST_MS);
    await w.cycle();
    expect(w.engagements.get("u0")!.startedAt).not.toBe(started);
  });

  it("polls an active listener on every 30-second cron tick", async () => {
    const w = world(1);
    w.playing.set("user0", { artist: "Metallica", title: "One" });
    const stats = await w.runFor(5 * MINUTE);
    expect(stats.map((s) => s.polled)).toEqual(Array(10).fill(1));
  });

  it("marks an engagement stale after 15 minutes with nothing playing", async () => {
    const w = world(1);
    w.playing.set("user0", { artist: "Metallica", title: "One" });
    await w.runFor(60_000);
    w.playing.set("user0", null);
    await w.runFor(14 * MINUTE);
    expect(w.engagements.has("u0")).toBe(true);
    await w.runFor(2 * MINUTE);
    expect(w.engagements.has("u0")).toBe(false);
  });

  it("backs off on a rate-limit error and hands unpolled accounts back", async () => {
    const w = world(30);
    w.rateLimit(1);
    const stats = await w.cycle();
    expect(stats.rateLimited).toBe(1);
    expect(stats.polled).toBe(0);
    expect(stats.released).toBeGreaterThan(0);
    // Everyone is due again soon, nobody is lost.
    for (const a of w.acct.values()) expect(a.nextPollAt - w.clock.now()).toBeLessThanOrEqual(90_000);
  });

  it("stays under 4 requests/second with 150 accounts, and still reaches everyone", async () => {
    const w = world(150);
    // A third of the crowd changes song every ~4 minutes; the rest are idle.
    for (let i = 0; i < 50; i++) w.playing.set(`user${i}`, { artist: `Metal Band ${i % 12}`, title: "Song 0" });
    let song = 0;
    const stats = [];
    for (let block = 0; block < 8; block++) {
      song++;
      for (let i = 0; i < 50; i++) w.playing.set(`user${i}`, { artist: `Metal Band ${i % 12}`, title: `Song ${song}` });
      stats.push(...(await w.runFor(4 * MINUTE)));
    }

    const times = w.requests.map((r) => r.at);
    expect(peakPerSecond(times)).toBeLessThanOrEqual(4);
    expect(stats.every((s) => s.rateLimited === 0 && s.errors === 0)).toBe(true);
    // Every account got polled; every active listener has an engagement on the latest song.
    for (const a of w.acct.values()) expect(a.nextPollAt).toBeGreaterThan(Date.UTC(2026, 8, 25, 20, 0, 0));
    for (let i = 0; i < 50; i++) expect(w.engagements.get(`u${i}`)?.title).toBe(`Song ${song}`);
    // 12 distinct artists: tags fetched once each, not per listener.
    expect(w.requests.filter((r) => r.method === "artist.gettoptags")).toHaveLength(12);
  });
});
