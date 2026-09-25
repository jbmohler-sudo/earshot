// The zone's social layout, ported from the Phase 0 prototype's reassign(). Pure and renderer-free:
// give it who is engaged with what, and it decides venues, tiers, slots, the stage item, and where
// each person stands. Call update() whenever the crowd changes; state carries hysteresis forward.
import type { Rect, TilePoint, ZoneLayout } from "./contracts.ts";
import { hashString } from "./rng.ts";
import { type Tier, tierOf } from "./tiers.ts";

/** Inner radius (tiles) of the front rows for each tier; the field starts FIELD_GAP further out. */
export const TIER_RADIUS: Record<Tier, number> = { busker: 1.3, tavern: 2.1, amph: 2.9, fest: 4.1 };
export const FIELD_GAP = 2.1;
/** A challenger takes slot 0 only with more than owner × 1.15 + 1 people. */
export const SLOT0_FACTOR = 1.15;
export const SLOT0_BONUS = 1;
/** An unslotted group evicts the weakest slotted group only with more than weakest + 2 people. */
export const EVICT_MARGIN = 2;
const GOLDEN = 0.61803398875;

export interface Participant {
  id: string;
  /** Who the venue is for. */
  groupKey: string;
  /** What exactly they're engaged with. */
  itemKey: string;
}

export type SpotKind = "front" | "field" | "plaza";

export interface VenueState {
  groupKey: string;
  count: number;
  tier: Tier;
  /** Slot index, or −1 while waiting in the plaza. */
  slot: number;
  /** The item most people here share; the incumbent keeps it on ties. */
  stageItem: string | null;
  /** Spot indices: a person keeps theirs while they stay; leavers leave holes the next arrival fills. */
  front: (string | null)[];
  field: (string | null)[];
}

export interface Placement {
  id: string;
  groupKey: string;
  kind: SpotKind;
  slot: number;
  index: number;
  /** Tile-space spot to stand on; null in the plaza (the renderer lets people mill about). */
  target: TilePoint | null;
}

export function clampToRect(x: number, y: number, r: Rect): TilePoint {
  return [Math.min(r.x1, Math.max(r.x0, x)), Math.min(r.y1, Math.max(r.y0, y))];
}

/** Per-person jitter in [0, 0.25) so crowds don't look gridded. Stable for an id. */
export function spotJitter(id: string): number {
  return ((hashString(id) % 1000) / 1000) * 0.25;
}

/**
 * Golden-ratio spread in a half-disk facing the viewer (toward +x+y). Index 0 is closest to the stage;
 * each index lands at a new angle so neighbours don't stack.
 */
export function spotFor(at: TilePoint, tier: Tier, kind: "front" | "field", index: number, jitter: number, bounds: Rect): TilePoint {
  const front = kind === "front";
  const r0 = front ? TIER_RADIUS[tier] : TIER_RADIUS[tier] + FIELD_GAP;
  const r = r0 + Math.sqrt(index) * (front ? 0.5 : 0.62) + jitter;
  const f = ((index * GOLDEN) % 1) * 2 - 1;
  const a = Math.PI / 4 + f * (front ? 1.1 : 1.45);
  return clampToRect(at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r, bounds);
}

/** The item with the most people; `incumbent` keeps the stage unless strictly beaten. */
export function pickStageItem(counts: Map<string, number>, incumbent: string | null): string | null {
  let best = incumbent;
  let bestN = incumbent === null ? 0 : (counts.get(incumbent) ?? 0);
  for (const [item, n] of counts) {
    if (n > bestN) {
      best = item;
      bestN = n;
    }
  }
  return bestN > 0 ? best : null;
}

export class World {
  readonly layout: ZoneLayout;
  readonly venues = new Map<string, VenueState>();
  private readonly slotOwner: (VenueState | null)[];
  private readonly placed = new Map<string, Placement & { key: string }>();

  constructor(layout: ZoneLayout) {
    this.layout = layout;
    this.slotOwner = new Array<VenueState | null>(layout.slots.length).fill(null);
  }

  placement(id: string): Placement | undefined {
    return this.placed.get(id);
  }

  placements(): Placement[] {
    return [...this.placed.values()];
  }

  /** Venues with people, biggest first. */
  activeVenues(): VenueState[] {
    return [...this.venues.values()].filter((v) => v.count > 0).sort(byCount);
  }

  slotOf(slot: number): VenueState | null {
    return this.slotOwner[slot] ?? null;
  }

  /**
   * Re-run the layout for the current crowd. `initial` lets the biggest group take slot 0 outright
   * (first load, when there's no history to be stable against).
   */
  update(people: readonly Participant[], initial = false): void {
    // Counts per group.
    const counts = new Map<string, number>();
    for (const p of people) counts.set(p.groupKey, (counts.get(p.groupKey) ?? 0) + 1);
    for (const [g, n] of counts) this.venueFor(g).count = n;
    for (const v of this.venues.values()) {
      if (!counts.has(v.groupKey)) {
        v.count = 0;
        if (v.slot >= 0) this.setSlot(v, -1);
      }
    }

    // Slot 0 with hysteresis.
    const ranked = this.activeVenues();
    const top = ranked[0];
    if (top && top.slot !== 0) {
      const cur = this.slotOwner[0] ?? null;
      if (!cur || initial || top.count > cur.count * SLOT0_FACTOR + SLOT0_BONUS) {
        const old = top.slot;
        if (cur) this.setSlot(cur, -1);
        this.setSlot(top, 0);
        if (cur) this.setSlot(cur, old);
      }
    }

    // Other slots: fill free ones, else evict the weakest if clearly beaten.
    for (const v of ranked) {
      if (v.slot >= 0) continue;
      let free = -1;
      for (let s = 1; s < this.slotOwner.length; s++) {
        if (!this.slotOwner[s]) {
          free = s;
          break;
        }
      }
      if (free < 0) {
        let weakest: VenueState | null = null;
        for (let s = 1; s < this.slotOwner.length; s++) {
          const w = this.slotOwner[s]!;
          if (!weakest || w.count < weakest.count) weakest = w;
        }
        if (weakest && v.count > weakest.count + EVICT_MARGIN) {
          free = weakest.slot;
          this.setSlot(weakest, -1);
        }
      }
      if (free >= 0) this.setSlot(v, free);
    }

    // Tier and stage item.
    const itemCounts = new Map<string, Map<string, number>>();
    for (const p of people) {
      let m = itemCounts.get(p.groupKey);
      if (!m) itemCounts.set(p.groupKey, (m = new Map()));
      m.set(p.itemKey, (m.get(p.itemKey) ?? 0) + 1);
    }
    for (const v of this.venues.values()) {
      if (v.count === 0) continue;
      v.tier = tierOf(v.count);
      v.stageItem = pickStageItem(itemCounts.get(v.groupKey) ?? new Map(), v.stageItem);
    }

    // People: leave vanished, then (re)group and place.
    const present = new Set(people.map((p) => p.id));
    for (const [id, pl] of this.placed) {
      if (!present.has(id)) {
        this.leaveGroup(pl);
        this.placed.delete(id);
      }
    }
    for (const p of people) {
      const v = this.venues.get(p.groupKey)!;
      const kind: SpotKind = v.slot < 0 ? "plaza" : p.itemKey === v.stageItem ? "front" : "field";
      const key = kind === "plaza" ? "plaza" : `${v.groupKey}|${kind}`;
      let pl = this.placed.get(p.id);
      if (!pl || pl.key !== key) {
        if (pl) this.leaveGroup(pl);
        const index = kind === "plaza" ? -1 : this.joinGroup(v, kind, p.id);
        pl = { id: p.id, groupKey: p.groupKey, kind, slot: v.slot, index, target: null, key };
        this.placed.set(p.id, pl);
      }
      pl.groupKey = p.groupKey;
      pl.slot = v.slot;
      pl.target =
        kind === "plaza" ? null : spotFor(this.layout.slots[v.slot]!, v.tier, kind, pl.index, spotJitter(p.id), this.layout.bounds);
    }

    for (const v of this.venues.values()) {
      if (v.count === 0) {
        v.front = [];
        v.field = [];
        v.stageItem = null;
      }
    }
  }

  private venueFor(groupKey: string): VenueState {
    let v = this.venues.get(groupKey);
    if (!v) {
      v = { groupKey, count: 0, tier: "busker", slot: -1, stageItem: null, front: [], field: [] };
      this.venues.set(groupKey, v);
    }
    return v;
  }

  private setSlot(v: VenueState, s: number): void {
    if (v.slot >= 0 && this.slotOwner[v.slot] === v) this.slotOwner[v.slot] = null;
    v.slot = s;
    if (s >= 0) this.slotOwner[s] = v;
  }

  private joinGroup(v: VenueState, kind: "front" | "field", id: string): number {
    const arr = v[kind];
    const hole = arr.indexOf(null);
    if (hole >= 0) {
      arr[hole] = id;
      return hole;
    }
    arr.push(id);
    return arr.length - 1;
  }

  private leaveGroup(pl: Placement & { key: string }): void {
    if (pl.kind === "plaza") return;
    const v = this.venues.get(pl.groupKey);
    const arr = v?.[pl.kind];
    if (arr && arr[pl.index] === pl.id) arr[pl.index] = null;
  }
}

function byCount(a: VenueState, b: VenueState): number {
  return b.count - a.count || (a.groupKey < b.groupKey ? -1 : a.groupKey > b.groupKey ? 1 : 0);
}
