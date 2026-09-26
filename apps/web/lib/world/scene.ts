// A laid-out zone: who stands where (spot kind, slot, index) and the venues that implies.
// The real view builds it from server-written presence rows; the sim builds it with a local World.
// Either way the renderer only animates it.
import { type SpotKind, type Tier, tierOf, type World } from "@earshot/core";
import type { Avatar } from "@/lib/avatar";
import { lookOf, parseAvatar } from "@/lib/avatar";
import type { PersonView } from "./types";

export interface PlacedPerson extends PersonView {
  kind: SpotKind;
  /** null in the plaza */
  slot: number | null;
  index: number | null;
}

export interface SceneVenue {
  groupKey: string;
  groupName: string;
  count: number;
  tier: Tier;
  /** null while waiting in the plaza */
  slot: number | null;
  stageTitle: string | null;
  front: number;
}

export interface Scene {
  people: PlacedPerson[];
  /** Biggest first. */
  venues: SceneVenue[];
}

export function sceneOf(people: PlacedPerson[]): Scene {
  const groups = new Map<string, PlacedPerson[]>();
  for (const p of people) {
    let g = groups.get(p.groupKey);
    if (!g) groups.set(p.groupKey, (g = []));
    g.push(p);
  }
  const venues = [...groups].map(([groupKey, members]): SceneVenue => {
    const front = members.filter((m) => m.kind === "front");
    return {
      groupKey,
      groupName: members[0]!.groupName,
      count: members.length,
      tier: tierOf(members.length),
      slot: members.find((m) => m.slot !== null)?.slot ?? null,
      stageTitle: front[0]?.itemTitle ?? null,
      front: front.length,
    };
  });
  venues.sort((a, b) => b.count - a.count || a.groupKey.localeCompare(b.groupKey));
  return { people, venues };
}

/** Sim mode: lay the crowd out locally with the same core World the server uses. */
export function sceneFromWorld(world: World, people: PersonView[], initial = false): Scene {
  world.update(
    people.map((p) => ({ id: p.id, groupKey: p.groupKey, itemKey: p.itemKey })),
    initial,
  );
  return sceneOf(
    people.map((p) => {
      const pl = world.placement(p.id)!;
      return { ...p, kind: pl.kind, slot: pl.kind === "plaza" ? null : pl.slot, index: pl.kind === "plaza" ? null : pl.index };
    }),
  );
}

/** A presence row as clients read it (see supabase/migrations/*_presence_layout.sql). */
export interface PresenceRecord {
  user_id: string;
  zone_id: string;
  artist_key: string;
  item_key: string;
  spot: "stage" | "field" | "plaza";
  slot: number | null;
  spot_index: number | null;
  artist_name: string;
  title: string;
  display_name: string | null;
  avatar: unknown;
}

export const PRESENCE_COLUMNS = "user_id, zone_id, artist_key, item_key, spot, slot, spot_index, artist_name, title, display_name, avatar";

export function sceneFromPresence(rows: Iterable<PresenceRecord>, viewerId: string | null): Scene {
  const people: PlacedPerson[] = [];
  for (const r of rows) {
    const avatar: Avatar = parseAvatar(r.avatar);
    people.push({
      id: r.user_id,
      name: r.display_name || "listener",
      look: lookOf(avatar),
      groupKey: r.artist_key,
      groupName: r.artist_name || r.artist_key,
      itemKey: r.item_key,
      itemTitle: r.title,
      you: r.user_id === viewerId,
      kind: r.spot === "stage" ? "front" : r.spot,
      slot: r.slot,
      index: r.spot_index,
    });
  }
  return sceneOf(people);
}
