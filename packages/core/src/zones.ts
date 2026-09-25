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
  /** Winning score as a share of the total weight considered, 0–1. */
  confidence: number;
  scores: Record<string, number>;
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
 * Score each zone as Σ weight(tag) × claims([tag]). The highest score wins; ties go to the earlier zone.
 * Scores of 0 everywhere go to the fallback zone.
 */
export function pickZone(tags: readonly WeightedTag[], zones: readonly ZoneClaimer[], fallbackId: string): ZonePick {
  const scores: Record<string, number> = {};
  let best: { id: string; score: number } | null = null;
  for (const z of zones) {
    let score = 0;
    for (const t of tags) if (t.count > 0 && z.claims([t.name]) > 0) score += t.count;
    scores[z.id] = score;
    if (score > 0 && (!best || score > best.score)) best = { id: z.id, score };
  }
  const total = tags.reduce((s, t) => s + Math.max(0, t.count), 0);
  if (!best) return { zoneId: fallbackId, confidence: 0, scores };
  return { zoneId: best.id, confidence: total > 0 ? Math.min(1, best.score / total) : 0, scores };
}
