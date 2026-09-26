// Server-side layout: run World for every zone and diff the result into presence rows, so every
// viewer sees the same world. World state (slot hysteresis, spot indices) is persisted per zone.
import type { ZoneLayout } from "./contracts.ts";
import { type SpotKind, World, type WorldSnapshot } from "./world.ts";

/** Presence rows use "stage" for the front rows. */
export type PresenceSpot = "stage" | "field" | "plaza";
export const spotOfKind = (k: SpotKind): PresenceSpot => (k === "front" ? "stage" : k);

export interface LayoutParticipant {
  id: string;
  zoneId: string;
  groupKey: string;
  itemKey: string;
  /** Opaque display fields copied into the presence row (names, titles, avatar). */
  display: Record<string, unknown>;
}

export interface PresenceRow {
  userId: string;
  zoneId: string;
  groupKey: string;
  itemKey: string;
  spot: PresenceSpot;
  /** null in the plaza. */
  slot: number | null;
  spotIndex: number | null;
  display: Record<string, unknown>;
}

export interface LayoutStore {
  /** Everyone who should be in the world right now (visible, with a current engagement). */
  loadParticipants(): Promise<LayoutParticipant[]>;
  loadStates(): Promise<Map<string, WorldSnapshot>>;
  saveState(zoneId: string, snap: WorldSnapshot): Promise<void>;
  loadPresence(): Promise<PresenceRow[]>;
  deletePresence(userIds: string[]): Promise<void>;
  upsertPresence(rows: PresenceRow[]): Promise<void>;
}

export interface SyncStats {
  participants: number;
  upserted: number;
  deleted: number;
  moved: number;
  statesSaved: number;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function rowsEqual(a: PresenceRow, b: PresenceRow): boolean {
  return (
    a.zoneId === b.zoneId &&
    a.groupKey === b.groupKey &&
    a.itemKey === b.itemKey &&
    a.spot === b.spot &&
    a.slot === b.slot &&
    a.spotIndex === b.spotIndex &&
    same(a.display, b.display)
  );
}

export async function syncPresence(store: LayoutStore, layouts: Record<string, ZoneLayout>, fallbackZoneId: string): Promise<SyncStats> {
  const [participants, states, current] = await Promise.all([store.loadParticipants(), store.loadStates(), store.loadPresence()]);

  // Group by zone; unknown zones fall back.
  const byZone = new Map<string, LayoutParticipant[]>();
  for (const zoneId of Object.keys(layouts)) byZone.set(zoneId, []);
  for (const p of participants) {
    const zoneId = layouts[p.zoneId] ? p.zoneId : fallbackZoneId;
    byZone.get(zoneId)?.push({ ...p, zoneId });
  }

  const desired = new Map<string, PresenceRow>();
  let statesSaved = 0;
  for (const [zoneId, people] of byZone) {
    const prev = states.get(zoneId);
    const world = World.fromJSON(layouts[zoneId]!, prev);
    world.update(
      people.map((p) => ({ id: p.id, groupKey: p.groupKey, itemKey: p.itemKey })),
      !prev, // no history yet: let the biggest group take slot 0 outright
    );
    for (const p of people) {
      const pl = world.placement(p.id)!;
      desired.set(p.id, {
        userId: p.id,
        zoneId,
        groupKey: p.groupKey,
        itemKey: p.itemKey,
        spot: spotOfKind(pl.kind),
        slot: pl.kind === "plaza" ? null : pl.slot,
        spotIndex: pl.kind === "plaza" ? null : pl.index,
        display: p.display,
      });
    }
    const snap = world.toJSON();
    if (!same(snap, prev)) {
      await store.saveState(zoneId, snap);
      statesSaved++;
    }
  }

  // Diff. A zone change is delete + insert so the old zone's subscribers hear about it.
  const currentById = new Map(current.map((r) => [r.userId, r]));
  const deletes: string[] = [];
  const upserts: PresenceRow[] = [];
  let moved = 0;
  for (const r of current) {
    const want = desired.get(r.userId);
    if (!want) deletes.push(r.userId);
    else if (want.zoneId !== r.zoneId) {
      deletes.push(r.userId);
      moved++;
    }
  }
  for (const want of desired.values()) {
    const have = currentById.get(want.userId);
    if (!have || have.zoneId !== want.zoneId || !rowsEqual(have, want)) upserts.push(want);
  }
  if (deletes.length) await store.deletePresence(deletes);
  if (upserts.length) await store.upsertPresence(upserts);

  return { participants: participants.length, upserted: upserts.length, deleted: deletes.length, moved, statesSaved };
}
