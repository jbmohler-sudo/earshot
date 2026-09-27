// Pre-rendered sprite sheets (PNG + JSON manifest). Zones draw them through Painter.sprite(); when a
// sheet isn't loaded (tests, previews, a failed fetch) drawSprite runs the procedural fallback, so
// migration is per-prop and never flag day. See docs/SPRITES.md.
//
// Dependency direction stays app → zone → core: the web app loads sheets and registers them here;
// zones only look them up by (zone, name), so they never import the app or a graphics library.
import type { Painter } from "./painter.ts";

/** One frame's rect on the sheet; (ax, ay) is the ground-contact anchor in px from the frame's top-left. */
export interface SpriteFrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

export interface SpriteManifest {
  frames: Record<string, SpriteFrameRect>;
  animations: Record<string, string[]>;
}

/** A loaded sheet. The backend attaches its own image/texture; core only needs the manifest. */
export interface SpriteSheet {
  manifest: SpriteManifest;
}

/** Pick the animation frame for time t (seconds) at fps. Null when unknown. */
export function frameFor(manifest: SpriteManifest, anim: string, t: number, fps = 8): string | null {
  const frames = manifest.animations[anim];
  if (!frames || frames.length === 0) return null;
  const i = Math.floor(Math.max(0, t) * fps) % frames.length;
  return frames[i]!;
}

/**
 * Draw a sprite frame with its anchor at art-pixel (x, y).
 * Runs `fallback` (the procedural drawing) when the sheet isn't loaded, the frame is missing, or the
 * painter can't blit. Without a fallback it draws a translucent magenta footprint so a missing
 * sprite is visible rather than silently gone.
 */
export function drawSprite(
  p: Painter,
  sheet: SpriteSheet | null,
  frame: string,
  x: number,
  y: number,
  alpha = 1,
  fallback?: (p: Painter) => void,
): void {
  const rect = sheet?.manifest.frames[frame];
  if (sheet && rect && p.sprite) {
    p.sprite(sheet, frame, Math.round(x), Math.round(y), alpha);
    return;
  }
  if (fallback) {
    fallback(p);
    return;
  }
  if (rect) p.rect(Math.round(x - rect.ax), Math.round(y - rect.ay), rect.w, rect.h, "#ff00ff", 0.35 * alpha);
  else p.rect(Math.round(x) - 4, Math.round(y) - 8, 8, 8, "#ff00ff", 0.35 * alpha);
}

// ---------------------------------------------------------------- registry

const sheets = new Map<string, SpriteSheet>();
const key = (zone: string, name: string) => `${zone}/${name}`;

/** Make a loaded sheet available to zones. Called by the app's loader. */
export function registerSheet(zone: string, name: string, sheet: SpriteSheet): void {
  sheets.set(key(zone, name), sheet);
}

/** The sheet for (zone, name), or null while it's loading, failed, or was never requested. */
export function getSheet(zone: string, name: string): SpriteSheet | null {
  return sheets.get(key(zone, name)) ?? null;
}

/** Forget every registered sheet (tests). */
export function clearSheets(): void {
  sheets.clear();
}
