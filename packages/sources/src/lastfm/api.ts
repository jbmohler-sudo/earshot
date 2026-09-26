// Read-only Last.fm API calls used by the poller and genre mapper.

export const LASTFM_API_ROOT = "https://ws.audioscrobbler.com/2.0/";
const USER_AGENT = "Earshot/0.1 (+https://earshot.world)";

/** Last.fm API error. Code 29 (or HTTP 429) means we are over the rate limit. */
export class LastfmError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(`Last.fm error ${code}: ${message}`);
    this.code = code;
  }
  get rateLimited(): boolean {
    return this.code === 29 || this.code === 429;
  }
}

/** Last.fm errors that mean "this account can't be read": user not found, or listening history is private. */
export const ACCOUNT_UNREADABLE_CODES = new Set([6, 17]);

export async function lastfmGet(params: Record<string, string>, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const url = new URL(LASTFM_API_ROOT);
  for (const [k, v] of Object.entries({ ...params, api_key: apiKey, format: "json" })) url.searchParams.set(k, v);
  const res = await fetchImpl(url, { headers: { "user-agent": USER_AGENT } });
  if (res.status === 429) throw new LastfmError(429, "HTTP 429 Too Many Requests");
  let json: { error?: number; message?: string };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new LastfmError(res.status, `non-JSON response (HTTP ${res.status})`);
  }
  if (json.error) throw new LastfmError(json.error, json.message ?? "unknown error");
  if (!res.ok) throw new LastfmError(res.status, `HTTP ${res.status}`);
  return json;
}

export function normalizeKey(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Words that mark a release variant of the same song, not a different song. */
const VARIANT = /\b(re-?master(ed)?|live|deluxe|radio edit|edit|mono|stereo|version|bonus( track)?|explicit|clean|single|album|anniversary|expanded|edition|demo|acoustic)\b/i;
const FEAT = /^(feat\.?|ft\.?|featuring|with)\s/i;

/**
 * Stage-song key: variants of one song compare equal. Case-insensitive; drops bracketed or dashed
 * variant suffixes ("(Remastered)", "- Remastered 2008", "(Live)", "(Deluxe)", "(Radio Edit)"),
 * featured artists, punctuation and extra whitespace. Display keeps the original title.
 */
export function songKey(title: string): string {
  let t = title.normalize("NFKC").toLowerCase();
  // Bracketed groups that are features or variants: "(feat. X)", "[Remastered 2011]", "(Live at …)".
  t = t.replace(/[([]([^)\]]*)[)\]]/g, (m, inner: string) => (FEAT.test(inner.trim()) || VARIANT.test(inner) ? " " : m));
  // Dashed suffixes, from the end, while they're variants or features: "- Remastered 2008", "- Live".
  const parts = t.split(/\s+[-–—]\s+/);
  while (parts.length > 1 && (VARIANT.test(parts[parts.length - 1]!) || FEAT.test(parts[parts.length - 1]!.trim()))) parts.pop();
  t = parts.join(" ");
  // A bare "feat. X" / "ft. X" / "featuring X" tail.
  t = t.replace(/\s(feat\.?|ft\.?|featuring)\s.*$/, "");
  // Punctuation: apostrophes vanish ("don't" → "dont"), everything else becomes a space.
  t = t.replace(/['’`]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return t || normalizeKey(title);
}

export interface NowPlaying {
  artist: string;
  title: string;
  artistKey: string;
  /** artistKey|songKey(title): what the stage song is grouped by */
  itemKey: string;
}

type LfmText = { "#text"?: string; name?: string } | string | undefined;
const text = (v: LfmText): string => (typeof v === "string" ? v : (v?.["#text"] ?? v?.name ?? "")).trim();

interface RecentTrack {
  name?: string;
  artist?: LfmText;
  "@attr"?: { nowplaying?: string };
}

/** Pull the now-playing track out of a user.getRecentTracks response, if there is one. */
export function parseNowPlaying(json: unknown): NowPlaying | null {
  const raw = (json as { recenttracks?: { track?: RecentTrack | RecentTrack[] } })?.recenttracks?.track;
  const tracks = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const t = tracks.find((x) => x?.["@attr"]?.nowplaying === "true");
  if (!t) return null;
  const artist = text(t.artist);
  const title = (t.name ?? "").trim();
  if (!artist || !title) return null;
  const artistKey = normalizeKey(artist);
  return { artist, title, artistKey, itemKey: `${artistKey}|${songKey(title)}` };
}

export async function getNowPlaying(username: string, apiKey: string, fetchImpl?: typeof fetch): Promise<NowPlaying | null> {
  const json = await lastfmGet({ method: "user.getrecenttracks", user: username, limit: "1" }, apiKey, fetchImpl);
  return parseNowPlaying(json);
}

export interface TopTag {
  name: string;
  count: number;
}

export function parseTopTags(json: unknown, max = 10): TopTag[] {
  const raw = (json as { toptags?: { tag?: { name?: string; count?: number | string }[] | { name?: string; count?: number | string } } })?.toptags?.tag;
  const tags = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return tags
    .map((t) => ({ name: (t.name ?? "").trim(), count: Number(t.count) || 0 }))
    .filter((t) => t.name && t.count > 0)
    .slice(0, max);
}

/** artist.getTopTags. An unknown artist returns [] rather than throwing. */
export async function getTopTags(artist: string, apiKey: string, fetchImpl?: typeof fetch): Promise<TopTag[]> {
  try {
    const json = await lastfmGet({ method: "artist.gettoptags", artist, autocorrect: "1" }, apiKey, fetchImpl);
    return parseTopTags(json);
  } catch (e) {
    if (e instanceof LastfmError && e.code === 6) return [];
    throw e;
  }
}
