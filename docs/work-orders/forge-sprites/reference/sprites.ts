// Sprite sheets rendered by the Blender pipeline (docs/ART_PIPELINE.md).
// Zones draw them through Painter.sprite(); when a sheet isn't loaded (tests,
// previews, not-yet-rendered zones) drawSprite falls back to procedural art,
// so migration is per-prop and never flag day.
import type { Painter } from "./painter.ts";

/** One frame's rect on the sheet; (ax, ay) is the ground-contact anchor in px. */
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

/** Backend image attached by the loader; core only needs the manifest. */
export interface SpriteSheet {
  manifest: SpriteManifest;
}

/** Pick the animation frame for time t (seconds) at fps. Null when unknown. */
export function frameFor(manifest: SpriteManifest, anim: string, t: number, fps = 8): string | null {
  const frames = manifest.animations[anim];
  if (!frames || frames.length === 0) return null;
  const i = Math.floor(t * fps) % frames.length;
  return frames[i]!;
}

/**
 * Draw a sprite frame with its anchor at art-pixel (x, y).
 * Falls back to `fallback` (or a placeholder box) when the painter or the
 * frame can't do sprites — keeps everything working before art exists.
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
  if (rect) {
    // Sheet exists but this painter can't blit: draw the frame's footprint.
    p.rect(Math.round(x - rect.ax), Math.round(y - rect.ay), rect.w, rect.h, "#ff00ff", 0.35 * alpha);
  } else {
    p.rect(Math.round(x) - 4, Math.round(y) - 8, 8, 8, "#ff00ff", 0.35 * alpha);
  }
}
