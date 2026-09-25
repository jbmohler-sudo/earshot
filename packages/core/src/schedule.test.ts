import { describe, expect, it } from "vitest";
import { baseDelay, FAST_MS, FULL_LOAD_ACCOUNTS, IDLE_MS, isStale, MINUTE, nextPollDelay } from "./schedule.ts";

const now = 10_000 * MINUTE;
const full = FULL_LOAD_ACCOUNTS;

describe("baseDelay (the brief's intervals)", () => {
  it("polls fast while the item changed in the last 10 minutes", () => {
    expect(baseDelay({ now, lastChangedAt: now - 9 * MINUTE, lastSeenAt: now, active: true })).toBe(FAST_MS);
  });
  it("backs off from 2 to 5 minutes once unchanged for 10+ minutes", () => {
    expect(baseDelay({ now, lastChangedAt: now - 10 * MINUTE, lastSeenAt: now, active: true })).toBe(2 * MINUTE);
    expect(baseDelay({ now, lastChangedAt: now - 15 * MINUTE, lastSeenAt: now, active: true })).toBe(3.5 * MINUTE);
    expect(baseDelay({ now, lastChangedAt: now - 60 * MINUTE, lastSeenAt: now, active: true })).toBe(5 * MINUTE);
  });
  it("drops to every 10 minutes after 15 minutes with nothing playing", () => {
    expect(baseDelay({ now, lastChangedAt: now - 20 * MINUTE, lastSeenAt: now - 15 * MINUTE, active: false })).toBe(IDLE_MS);
    expect(baseDelay({ now, lastChangedAt: null, lastSeenAt: null, active: false })).toBe(IDLE_MS);
  });
  it("keeps the change-based rate during a short gap between items", () => {
    expect(baseDelay({ now, lastChangedAt: now - 4 * MINUTE, lastSeenAt: now - 1 * MINUTE, active: false })).toBe(FAST_MS);
  });
});

describe("nextPollDelay (load scaling)", () => {
  const idle = { now, lastChangedAt: null, lastSeenAt: null, active: false };
  it("uses the full backoff at full load", () => {
    expect(nextPollDelay({ ...idle, accounts: full })).toBe(IDLE_MS);
    expect(nextPollDelay({ ...idle, accounts: full * 3 })).toBe(IDLE_MS);
  });
  it("shrinks toward the fast rate with few accounts, never below it", () => {
    expect(nextPollDelay({ ...idle, accounts: 10 })).toBe(Math.round(IDLE_MS * (10 / full)));
    expect(nextPollDelay({ ...idle, accounts: 1 })).toBe(FAST_MS);
  });
});

describe("isStale", () => {
  it("is stale after 15 minutes unseen, or never seen", () => {
    expect(isStale(now - 14 * MINUTE, now)).toBe(false);
    expect(isStale(now - 15 * MINUTE, now)).toBe(true);
    expect(isStale(null, now)).toBe(true);
  });
});
