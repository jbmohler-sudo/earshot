// Loads pre-rendered sprite sheets, /sprites/<zone>/<name>.png + .json (see docs/SPRITES.md), and
// registers them with core so zones can find them with getSheet(zone, name). Failures are swallowed
// on purpose: an unloaded sheet means the zone keeps drawing its procedural art.
import { registerSheet, type SpriteManifest, type SpriteSheet } from "@earshot/core";
import { ImageSource, Texture } from "pixi.js";

export interface LoadedSheet extends SpriteSheet {
  /** Whole-sheet texture for PixiPainter. */
  texture: Texture;
  /** The decoded image, for canvasPainter's drawImage. */
  image: ImageBitmap;
}

const cache = new Map<string, Promise<LoadedSheet | null>>();

function isManifest(m: unknown): m is SpriteManifest {
  const frames = (m as SpriteManifest | null)?.frames;
  return !!frames && typeof frames === "object" && Object.values(frames).every((f) => [f.x, f.y, f.w, f.h, f.ax, f.ay].every(Number.isFinite));
}

async function fetchSheet(zone: string, name: string): Promise<LoadedSheet | null> {
  const base = `/sprites/${encodeURIComponent(zone)}/${encodeURIComponent(name)}`;
  try {
    // Manifest first: if it's missing there's no point asking for the image.
    const mr = await fetch(`${base}.json`);
    if (!mr.ok) return null;
    const manifest: unknown = await mr.json();
    if (!isManifest(manifest)) return null;
    const ir = await fetch(`${base}.png`);
    if (!ir.ok) return null;
    const image = await createImageBitmap(await ir.blob());
    const texture = new Texture({ source: new ImageSource({ resource: image, scaleMode: "nearest" }) });
    return { manifest: { frames: manifest.frames, animations: manifest.animations ?? {} }, texture, image };
  } catch {
    return null; // blocked, offline or undecodable: stay procedural
  }
}

/** Load one sheet (cached) and register it. Resolves null when it can't be loaded; never rejects. */
export function loadSheet(zone: string, name: string): Promise<LoadedSheet | null> {
  const key = `${zone}/${name}`;
  let p = cache.get(key);
  if (!p) {
    p = fetchSheet(zone, name).then((s) => {
      if (s) registerSheet(zone, name, s);
      return s;
    });
    cache.set(key, p);
  }
  return p;
}

/** Load every sheet a zone asks for. The render loop redraws each frame, so sprites appear as they land. */
export function loadZoneSheets(zone: string, names: readonly string[] = []): Promise<(LoadedSheet | null)[]> {
  return Promise.all(names.map((n) => loadSheet(zone, n)));
}
