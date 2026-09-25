// Plug-in contracts. Core deals in "engagements": a person, a thing, right now.
// Nothing in this package knows what kind of thing it is.

import type { Tier } from "./tiers";

/** A linked external account the poller reads from. */
export interface SourceAccount {
  userId: string;
  source: string;
  externalUsername: string;
  sessionKey: string;
  lastPolledAt: string | null;
  lastChangedAt: string | null;
}

/** One person engaged with one thing right now. */
export interface Engagement {
  userId: string;
  source: string;
  /** Stable key for the thing itself (e.g. a normalized "group|item" pair). */
  itemKey: string;
  title: string;
  /** Stable key for who made the thing; venues are grouped by this. */
  groupKey: string;
  groupName: string;
  tags: string[];
  startedAt: string;
  lastSeenAt: string;
}

export interface SourcePlugin {
  id: string;
  kind: string;
  poll(accounts: SourceAccount[]): Promise<Engagement[]>;
}

/** Spot on the zone map where a venue can stand, in tile coordinates. */
export type TilePoint = readonly [x: number, y: number];

export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface ZoneLayout {
  /** Map is size × size tiles. */
  size: number;
  /** Venue slots; slot 0 is the festival field reserved for the biggest group. */
  slots: readonly TilePoint[];
  /** Where unslotted people wait. */
  plaza: Rect;
  /** Tile edges people enter from and leave by. */
  spawnEdges: readonly ("east" | "south" | "west" | "north")[];
}

/** Renderer-agnostic hook; the web app supplies the drawing context. Filled in with the PixiJS port. */
export type VenueRenderer = (ctx: unknown, venue: { slot: number; tier: Tier; t: number }) => void;

export interface Emote {
  id: string;
  label: string;
}

export interface ZonePlugin {
  id: string;
  kind: string;
  /** Match score for a set of tags; highest wins, the fallback zone takes anything that scores 0 everywhere. */
  claims(tags: string[]): number;
  layout: ZoneLayout;
  venueStyles: Record<Tier, VenueRenderer>;
  emotes: Emote[];
}
