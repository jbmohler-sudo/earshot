// Adaptive polling for engagement sources.
// The brief's intervals assume the full load (≈120 accounts at 4 req/s every 30 s). With fewer
// accounts there is spare budget, so every interval shrinks toward FAST_MS in proportion to load.

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;

/** Poll interval for someone whose engagement changed in the last 10 minutes. */
export const FAST_MS = 30 * SECOND;
/** Engagement unchanged this long: start backing off. */
export const BACKOFF_AFTER_MS = 10 * MINUTE;
/** Backoff ramps from 2 to 5 minutes over the next 10 minutes of no change. */
export const BACKOFF_MIN_MS = 2 * MINUTE;
export const BACKOFF_MAX_MS = 5 * MINUTE;
/** Nothing engaged for this long: the engagement is stale and the person fades out. */
export const STALE_AFTER_MS = 15 * MINUTE;
export const IDLE_MS = 10 * MINUTE;
/** Accounts that fit in one FAST_MS cycle at the request budget (4 req/s × 30 s). */
export const FULL_LOAD_ACCOUNTS = 120;

export interface ScheduleInput {
  now: number;
  /** When the engaged item last changed (ms epoch), or null if never. */
  lastChangedAt: number | null;
  /** When an engagement was last observed (ms epoch), or null if never. */
  lastSeenAt: number | null;
  /** Whether something is engaged right now. */
  active: boolean;
  /** Number of linked accounts sharing the request budget. */
  accounts: number;
}

export function isStale(lastSeenAt: number | null, now: number): boolean {
  return lastSeenAt === null || now - lastSeenAt >= STALE_AFTER_MS;
}

/** The brief's interval before load scaling. */
export function baseDelay(i: Omit<ScheduleInput, "accounts">): number {
  if (!i.active && isStale(i.lastSeenAt, i.now)) return IDLE_MS;
  const sinceChange = i.lastChangedAt === null ? Infinity : i.now - i.lastChangedAt;
  if (sinceChange < BACKOFF_AFTER_MS) return FAST_MS;
  const ramp = Math.min(1, (sinceChange - BACKOFF_AFTER_MS) / BACKOFF_AFTER_MS);
  return BACKOFF_MIN_MS + ramp * (BACKOFF_MAX_MS - BACKOFF_MIN_MS);
}

export function loadFactor(accounts: number): number {
  return Math.min(1, Math.max(0, accounts / FULL_LOAD_ACCOUNTS));
}

/** How long to wait before polling this account again. */
export function nextPollDelay(i: ScheduleInput): number {
  const base = baseDelay(i);
  return Math.round(Math.max(FAST_MS, base * loadFactor(i.accounts)));
}
