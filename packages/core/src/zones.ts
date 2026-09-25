// Which zone does a set of weighted tags belong to? Zones claim tags; the highest weighted score wins.

export interface WeightedTag {
  name: string;
  /** Relative weight, e.g. 0–100. */
  count: number;
}

export interface ZoneClaimer {
  id: string;
  claims(tags: string[]): number;
}

export interface ZonePick {
  zoneId: string;
  /** Winning score as a share of the total weight considered, 0–1. 0 when the fallback was chosen. */
  confidence: number;
  /** Each zone's score, and the share the best claiming zone would have had. */
  scores: Record<string, number>;
  bestShare: number;
}

export interface PickOptions {
  /** A winner below this share of the total weight goes to the fallback instead. Default 0. */
  minConfidence?: number;
  /**
   * Per-tag multipliers (normalized names). Tags below 1 are "generic": they add to a zone's score
   * but can never carry a zone on their own. 0 ignores a tag entirely, even in the total.
   */
  tagWeights?: Record<string, number>;
}

export function normalizeTag(tag: string): string {
  return tag.normalize("NFKC").toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Build a claims() that counts how many of the given tags appear in `list`. */
export function matchTags(list: readonly string[]): (tags: string[]) => number {
  const set = new Set(list.map(normalizeTag));
  return (tags) => tags.filter((t) => set.has(normalizeTag(t))).length;
}

/**
 * Score each zone as Σ count(tag) × weight(tag) × claims([tag]). The highest score wins; ties go to the
 * earlier zone. A zone needs at least one full-weight tag to win, and its share of the total weighted
 * count must reach minConfidence; otherwise the fallback zone takes it.
 */
export function pickZone(
  tags: readonly WeightedTag[],
  zones: readonly ZoneClaimer[],
  fallbackId: string,
  opts: PickOptions = {},
): ZonePick {
  const weights = new Map(Object.entries(opts.tagWeights ?? {}).map(([k, v]) => [normalizeTag(k), v]));
  const weightOf = (name: string) => weights.get(normalizeTag(name)) ?? 1;
  const considered = tags.filter((t) => t.count > 0 && weightOf(t.name) > 0);
  const total = considered.reduce((s, t) => s + t.count * weightOf(t.name), 0);

  const scores: Record<string, number> = {};
  let best: { id: string; score: number } | null = null;
  for (const z of zones) {
    let score = 0;
    let anchored = false;
    for (const t of considered) {
      if (z.claims([t.name]) === 0) continue;
      const w = weightOf(t.name);
      score += t.count * w;
      if (w >= 1) anchored = true;
    }
    scores[z.id] = score;
    if (anchored && score > 0 && (!best || score > best.score)) best = { id: z.id, score };
  }

  const bestShare = best && total > 0 ? Math.min(1, best.score / total) : 0;
  if (!best || bestShare < (opts.minConfidence ?? 0)) return { zoneId: fallbackId, confidence: 0, scores, bestShare };
  return { zoneId: best.id, confidence: bestShare, scores, bestShare };
}
