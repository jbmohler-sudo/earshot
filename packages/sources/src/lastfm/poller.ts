// One poll cycle: claim due accounts, read what each is playing, map new artists to zones, reschedule.
// Pure apart from the injected store, fetch and clock, so it runs under vitest and in the Deno Edge Function.
import { isStale, nextPollDelay, pickZone, RateGate, type ZoneClaimer } from "@earshot/core";
import { ACCOUNT_UNREADABLE_CODES, getNowPlaying, getTopTags, LastfmError, type NowPlaying } from "./api.ts";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const TAG_TTL_MS = 30 * DAY_MS;

export interface DueAccount {
  userId: string;
  username: string;
  lastChangedAt: string | null;
  /** The engagement currently on record, if any. */
  itemKey: string | null;
  lastSeenAt: string | null;
}

export interface ArtistZone {
  artistKey: string;
  artistName: string;
  zoneId: string;
  confidence: number;
  tags: string[];
  updatedAt: string;
}

export interface EngagementWrite {
  userId: string;
  itemKey: string;
  title: string;
  artist: string;
  tags: string[];
  /** Set only when the item changed; otherwise the existing start time is kept. */
  startedAt?: string;
  lastSeenAt: string;
}

export interface AccountUpdate {
  lastPolledAt: string;
  lastChangedAt: string | null;
  nextPollAt: string;
  lastError: string | null;
}

export interface PollerStore {
  countAccounts(): Promise<number>;
  /** Lease up to `limit` due accounts (pushing their next_poll_at out by `leaseSeconds`) and return them. */
  claimDue(limit: number, leaseSeconds: number): Promise<DueAccount[]>;
  getArtist(artistKey: string): Promise<ArtistZone | null>;
  saveArtist(a: ArtistZone): Promise<void>;
  saveEngagement(e: EngagementWrite): Promise<void>;
  /** Remove the engagement (and presence): the person fades out. */
  clearEngagement(userId: string): Promise<void>;
  finishAccount(userId: string, u: AccountUpdate): Promise<void>;
  /** Give a claimed account back unpolled, due again at `nextPollAt`. */
  releaseAccount(userId: string, nextPollAt: string): Promise<void>;
}

export interface PollerOptions {
  apiKey: string;
  store: PollerStore;
  zones: readonly ZoneClaimer[];
  fallbackZoneId: string;
  overrides?: Record<string, string>;
  gate: RateGate;
  now?: () => number;
  fetch?: typeof fetch;
  /** Stop claiming new work after this long, so cron runs never overlap. */
  budgetMs?: number;
  batchSize?: number;
  log?: (event: string, data?: Record<string, unknown>) => void;
}

export interface CycleStats {
  accounts: number;
  polled: number;
  playing: number;
  changed: number;
  stale: number;
  tagLookups: number;
  errors: number;
  rateLimited: number;
  released: number;
  ms: number;
}

const LEASE_SECONDS = 90;
const RATE_LIMIT_PAUSE_MS = 15_000;
const ERROR_RETRY_MS = 2 * 60_000;
const UNREADABLE_RETRY_MS = 60 * 60_000;
/**
 * Cron ticks every 30 s but a poll finishes a moment after its tick started, so "30 s from now"
 * would land just after the next tick and slip to 60 s. Scheduling a little early keeps the cadence.
 */
export const SCHEDULE_SLACK_MS = 5_000;

export async function runPollCycle(o: PollerOptions): Promise<CycleStats> {
  const now = o.now ?? (() => Date.now());
  const log = o.log ?? (() => {});
  const budgetMs = o.budgetMs ?? 25_000;
  const batchSize = o.batchSize ?? 20;
  const iso = (ms: number) => new Date(ms).toISOString();
  const ms = (s: string | null) => (s === null ? null : Date.parse(s));
  const start = now();
  const stats: CycleStats = { accounts: 0, polled: 0, playing: 0, changed: 0, stale: 0, tagLookups: 0, errors: 0, rateLimited: 0, released: 0, ms: 0 };
  const artistCache = new Map<string, ArtistZone>();
  let halted = false;

  stats.accounts = await o.store.countAccounts();
  const outOfTime = () => now() - start >= budgetMs;

  async function resolveArtist(np: NowPlaying): Promise<ArtistZone | null> {
    const hit = artistCache.get(np.artistKey);
    if (hit) return hit;
    const override = o.overrides?.[np.artistKey];
    const cached = await o.store.getArtist(np.artistKey);
    const fresh = cached && now() - Date.parse(cached.updatedAt) < TAG_TTL_MS && (!override || cached.zoneId === override);
    if (cached && fresh) {
      artistCache.set(np.artistKey, cached);
      return cached;
    }
    let tags;
    try {
      await o.gate.wait();
      stats.tagLookups++;
      tags = await getTopTags(np.artist, o.apiKey, o.fetch);
    } catch (e) {
      if (e instanceof LastfmError && e.rateLimited) throw e;
      log("tags-failed", { artist: np.artistKey, message: e instanceof Error ? e.message : String(e) });
      return cached; // stale cache beats nothing; null means "try again next time"
    }
    const pick = override ? { zoneId: override, confidence: 1 } : pickZone(tags, o.zones, o.fallbackZoneId);
    const a: ArtistZone = {
      artistKey: np.artistKey,
      artistName: np.artist,
      zoneId: pick.zoneId,
      confidence: pick.confidence,
      tags: tags.map((t) => t.name),
      updatedAt: iso(now()),
    };
    await o.store.saveArtist(a);
    artistCache.set(np.artistKey, a);
    log("artist-mapped", { artist: a.artistKey, zone: a.zoneId, confidence: Number(a.confidence.toFixed(2)), override: !!override });
    return a;
  }

  function onRateLimit(e: LastfmError) {
    stats.rateLimited++;
    halted = true;
    o.gate.penalize(RATE_LIMIT_PAUSE_MS);
    log("rate-limited", { code: e.code, message: e.message });
  }

  while (!halted && !outOfTime()) {
    const batch = await o.store.claimDue(batchSize, LEASE_SECONDS);
    if (batch.length === 0) break;

    for (const acct of batch) {
      if (halted || outOfTime()) {
        await o.store.releaseAccount(acct.userId, iso(now() + (halted ? 60_000 : 0)));
        stats.released++;
        continue;
      }

      let np: NowPlaying | null;
      try {
        await o.gate.wait();
        np = await getNowPlaying(acct.username, o.apiKey, o.fetch);
      } catch (e) {
        if (e instanceof LastfmError && e.rateLimited) {
          onRateLimit(e);
          await o.store.releaseAccount(acct.userId, iso(now() + 60_000));
          stats.released++;
          continue;
        }
        stats.errors++;
        const unreadable = e instanceof LastfmError && ACCOUNT_UNREADABLE_CODES.has(e.code);
        const message = e instanceof Error ? e.message : String(e);
        log("poll-failed", { user: acct.userId, message });
        await o.store.finishAccount(acct.userId, {
          lastPolledAt: iso(now()),
          lastChangedAt: acct.lastChangedAt,
          nextPollAt: iso(now() + (unreadable ? UNREADABLE_RETRY_MS : ERROR_RETRY_MS)),
          lastError: message.slice(0, 500),
        });
        continue;
      }
      stats.polled++;

      const t = now();
      let lastChangedAt = ms(acct.lastChangedAt);
      let lastSeenAt = ms(acct.lastSeenAt);

      if (np) {
        stats.playing++;
        const changed = np.itemKey !== acct.itemKey;
        let artist: ArtistZone | null = null;
        try {
          artist = await resolveArtist(np);
        } catch (e) {
          if (e instanceof LastfmError && e.rateLimited) onRateLimit(e);
          else throw e;
        }
        await o.store.saveEngagement({
          userId: acct.userId,
          itemKey: np.itemKey,
          title: np.title,
          artist: np.artist,
          tags: artist?.tags ?? [],
          startedAt: changed ? iso(t) : undefined,
          lastSeenAt: iso(t),
        });
        if (changed) {
          stats.changed++;
          lastChangedAt = t;
        }
        lastSeenAt = t;
      } else if (acct.itemKey && isStale(lastSeenAt, t)) {
        await o.store.clearEngagement(acct.userId);
        stats.stale++;
      }

      const delay = nextPollDelay({ now: t, lastChangedAt, lastSeenAt, active: !!np, accounts: stats.accounts });
      await o.store.finishAccount(acct.userId, {
        lastPolledAt: iso(t),
        lastChangedAt: lastChangedAt === null ? null : iso(lastChangedAt),
        nextPollAt: iso(t + delay - SCHEDULE_SLACK_MS),
        lastError: null,
      });
    }
  }

  stats.ms = now() - start;
  return stats;
}
