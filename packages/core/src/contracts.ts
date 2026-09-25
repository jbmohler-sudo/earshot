// Plug-in contracts. Core deals in "engagements": a person, a thing, right now.
// Nothing in this package knows what kind of thing it is.

import type { Point } from "./iso.ts";
import type { Painter } from "./painter.ts";
import type { Tier } from "./tiers.ts";

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

/** A straight tile-space edge people enter from and leave by. */
export interface Edge {
  from: TilePoint;
  to: TilePoint;
}

export interface ZoneLayout {
  /** Map is size × size tiles. */
  size: number;
  /** Art-pixel canvas size and where tile (0, 0) projects to. */
  pixels: { w: number; h: number };
  origin: Point;
  /** Venue slots; slot 0 is the festival field reserved for the biggest group. */
  slots: readonly TilePoint[];
  /** Where unslotted people wait. */
  plaza: Rect;
  /** Where people may stand. */
  bounds: Rect;
  /** Edges people walk in from and out to. */
  spawnEdges: readonly Edge[];
  /** Where the camera starts. */
  focus: TilePoint;
}

export interface Frame {
  /** Seconds since start. */
  t: number;
  /** Seconds since the previous frame. */
  dt: number;
  /** False when the viewer prefers reduced motion. */
  motion: boolean;
}

export interface VenueView {
  slot: number;
  at: TilePoint;
  tier: Tier;
  count: number;
}

export interface VenueStyle {
  draw(p: Painter, v: VenueView, f: Frame): void;
  /** Light and particles drawn above everything (beams, sparks). */
  overlay?(p: Painter, v: VenueView, f: Frame): void;
  /** How far above the slot (art pixels) the venue's label floats. */
  labelLift: number;
  /** Tap target radius around the slot, in art pixels. */
  reach: number;
}

export interface Prop {
  /** Draw order, x + y of the prop's front corner. */
  depth: number;
  draw(p: Painter, f: Frame): void;
}

export interface ZoneScenery {
  /** Static ground, drawn once. */
  ground(p: Painter): void;
  /** Animated ground (water, lava, cracks), drawn every frame under everything else. */
  underlay?(p: Painter, f: Frame): void;
  props: readonly Prop[];
  /** Ambient effects drawn above everything (smoke, embers). */
  overlay?(p: Painter, f: Frame): void;
}

export interface Emote {
  id: string;
  label: string;
}

export interface ZoneTheme {
  name: string;
  /** Page and canvas background. */
  background: string;
  accent: string;
}

export interface ZonePlugin {
  id: string;
  kind: string;
  /** Match score for a set of tags; highest wins, the fallback zone takes anything that scores 0 everywhere. */
  claims(tags: string[]): number;
  layout: ZoneLayout;
  venueStyles: Record<Tier, VenueStyle>;
  scenery: ZoneScenery;
  emotes: Emote[];
  theme: ZoneTheme;
}
