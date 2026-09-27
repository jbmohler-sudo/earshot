// Loads Blender-rendered sprite sheets: /sprites/<zone>/<name>.png + .json.
// Cached per zone/name; sheets are committed PNGs (see docs/ART_PIPELINE.md).
import { Assets, Texture } from "pixi.js";
import type { SpriteManifest, SpriteSheet } from "@earshot/core";

export interface LoadedSheet extends SpriteSheet {
  texture: Texture;
  image: HTMLImageElement;
}

const cache = new Map<string, Promise<LoadedSheet>>();

export function loadSheet(zone: string, name: string): Promise<LoadedSheet> {
  const key = `${zone}/${name}`;
  let p = cache.get(key);
  if (!p) {
    p = (async (): Promise<LoadedSheet> => {
      const [manifest, texture] = await Promise.all([
        fetch(`/sprites/${zone}/${name}.json`).then((r): Promise<SpriteManifest> => {
          if (!r.ok) throw new Error(`sprite manifest missing: ${key}`);
          return r.json();
        }),
        Assets.load<Texture>(`/sprites/${zone}/${name}.png`),
      ]);
      const image = texture.source.resource as HTMLImageElement;
      return { manifest, texture, image };
    })();
    cache.set(key, p);
  }
  return p;
}
