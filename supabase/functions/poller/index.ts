// Last.fm poller. pg_cron POSTs here every 30 seconds with the shared x-poller-secret header.
// All logic lives in packages/sources (runPollCycle); this file is the Supabase-backed store.
import { RateGate } from "@earshot/core";
import { type PollerStore, runPollCycle } from "@earshot/sources/lastfm/poller";
import { CLAIMING_ZONES, FALLBACK_ZONE_ID, OVERRIDES } from "@earshot/zones/registry";
import { createClient } from "@supabase/supabase-js";

const SOURCE = "lastfm";
const env = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set`);
  return v;
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function supabaseStore(): PollerStore {
  const db = createClient(env("SUPABASE_URL"), env("EARSHOT_SECRET_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const check = <T>(r: { data: T; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data;
  };

  return {
    async countAccounts() {
      const r = await db.from("source_accounts").select("user_id", { count: "exact", head: true }).eq("source", SOURCE);
      if (r.error) throw new Error(`countAccounts: ${r.error.message}`);
      return r.count ?? 0;
    },
    async claimDue(limit, leaseSeconds) {
      const rows = check(
        await db.rpc("claim_due_accounts", { p_source: SOURCE, p_limit: limit, p_lease_seconds: leaseSeconds }),
        "claimDue",
      ) as { user_id: string; external_username: string; last_changed_at: string | null; item_key: string | null; last_seen_at: string | null }[];
      return rows.map((r) => ({
        userId: r.user_id,
        username: r.external_username,
        lastChangedAt: r.last_changed_at,
        itemKey: r.item_key,
        lastSeenAt: r.last_seen_at,
      }));
    },
    async getArtist(artistKey) {
      const r = check(await db.from("artist_zones").select("*").eq("artist_key", artistKey).maybeSingle(), "getArtist");
      if (!r) return null;
      return {
        artistKey: r.artist_key,
        artistName: r.artist_name ?? r.artist_key,
        zoneId: r.zone_id,
        confidence: r.confidence,
        tags: r.tags ?? [],
        updatedAt: r.updated_at,
      };
    },
    async saveArtist(a) {
      check(
        await db.from("artist_zones").upsert({
          artist_key: a.artistKey,
          artist_name: a.artistName,
          zone_id: a.zoneId,
          confidence: a.confidence,
          tags: a.tags,
          updated_at: a.updatedAt,
        }),
        "saveArtist",
      );
    },
    async saveEngagement(e) {
      const row = { user_id: e.userId, source: SOURCE, item_key: e.itemKey, title: e.title, artist: e.artist, tags: e.tags, last_seen_at: e.lastSeenAt };
      if (e.startedAt) {
        check(await db.from("engagements").upsert({ ...row, started_at: e.startedAt }), "saveEngagement");
      } else {
        const r = check(await db.from("engagements").update(row).eq("user_id", e.userId).select("user_id"), "saveEngagement");
        // Row vanished (e.g. disconnect raced us): recreate it.
        if (!r?.length) check(await db.from("engagements").upsert({ ...row, started_at: e.lastSeenAt }), "saveEngagement");
      }
    },
    async clearEngagement(userId) {
      check(await db.from("engagements").delete().eq("user_id", userId), "clearEngagement");
      check(await db.from("presence").delete().eq("user_id", userId), "clearPresence");
    },
    async finishAccount(userId, u) {
      check(
        await db
          .from("source_accounts")
          .update({ last_polled_at: u.lastPolledAt, last_changed_at: u.lastChangedAt, next_poll_at: u.nextPollAt, last_error: u.lastError })
          .eq("user_id", userId)
          .eq("source", SOURCE),
        "finishAccount",
      );
    },
    async releaseAccount(userId, nextPollAt) {
      check(await db.from("source_accounts").update({ next_poll_at: nextPollAt }).eq("user_id", userId).eq("source", SOURCE), "releaseAccount");
    },
  };
}

const log = (event: string, data: Record<string, unknown> = {}) => console.log(`poller ${event} ${JSON.stringify(data)}`);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!timingSafeEqual(req.headers.get("x-poller-secret") ?? "", env("POLLER_SECRET"))) {
    log("unauthorized");
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const stats = await runPollCycle({
      apiKey: env("LASTFM_API_KEY"),
      store: supabaseStore(),
      zones: CLAIMING_ZONES,
      fallbackZoneId: FALLBACK_ZONE_ID,
      overrides: OVERRIDES,
      gate: new RateGate(4),
      budgetMs: 25_000,
      log,
    });
    // Idle runs are the common case; only log runs that did something.
    if (stats.polled || stats.errors || stats.rateLimited) log("cycle", { ...stats });
    return Response.json(stats);
  } catch (e) {
    log("cycle-failed", { message: e instanceof Error ? e.message : String(e) });
    return Response.json({ error: "cycle failed" }, { status: 500 });
  }
});
