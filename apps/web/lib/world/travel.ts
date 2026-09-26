// Zone-travel choreography: when your own avatar moves zones while you're following it.
// Pure timing, so the overlay, the renderer and tests agree on one timeline.

export type TravelPhase = "walk" | "fade" | "map" | "title" | "go";

export interface TravelTimeline {
  /** Phase start times in ms from the moment we learn you moved. */
  walk: number;
  fade: number;
  map: number;
  title: number;
  go: number;
  /** When the destination zone should be requested (a head start on loading, under the title card). */
  prefetch: number;
}

/** ~2.5 s: walk off (0.7) · fade to map (0.25) · hop across (0.9) · title slams in (0.65) · go. */
export const FULL: TravelTimeline = { walk: 0, fade: 700, map: 950, title: 1850, go: 2500, prefetch: 950 };
/** Reduced motion: crossfade straight to the title card, no walking or hopping. */
export const REDUCED: TravelTimeline = { walk: 0, fade: 0, map: 0, title: 0, go: 1300, prefetch: 0 };

export function timelineFor(reducedMotion: boolean): TravelTimeline {
  return reducedMotion ? REDUCED : FULL;
}

export function phaseAt(tl: TravelTimeline, ms: number): TravelPhase {
  if (ms >= tl.go) return "go";
  if (ms >= tl.title) return "title";
  if (ms >= tl.map) return "map";
  if (ms >= tl.fade) return "fade";
  return "walk";
}

/** Hop progress (0..1) during the map phase. */
export function hopProgress(tl: TravelTimeline, ms: number): number {
  const span = tl.title - tl.map;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (ms - tl.map) / span));
}

/**
 * Should your own zone change play the full transition, or just a toast?
 * Full only when you were in the zone on screen and the camera was following you.
 */
export function travelMode(opts: { viewedZone: string; fromZone: string | null; toZone: string; followingSelf: boolean }): "transition" | "toast" | "none" {
  if (opts.toZone === opts.fromZone) return "none";
  if (opts.fromZone === opts.viewedZone && opts.followingSelf) return "transition";
  if (opts.toZone === opts.viewedZone) return "none"; // you walked into the zone you're looking at: nothing to announce
  return "toast";
}
