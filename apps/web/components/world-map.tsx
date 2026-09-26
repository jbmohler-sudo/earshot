"use client";

// The pixel world map. Reusable: the zone-travel transition drives `from`/`to`/`progress`;
// Phase 2's map/teleport can pass `onSelectZone` to make the landmarks clickable.
import type { Look } from "@earshot/core";
import { useEffect, useRef } from "react";
import { drawWorldMap, LANDMARKS, MAP_H, MAP_W } from "@/lib/world/map";
import { canvasPainter } from "@/lib/world/canvas-painter";
import { ZONES } from "@/lib/world/zones";

export interface WorldMapProps {
  /** Trip being shown: from → to, with hop progress 0..1 (a getter, so it can advance every frame). */
  from?: string;
  to?: string;
  progress?: () => number;
  /** Who's travelling / standing "here". */
  look?: Look;
  /** Zone to mark as "you are here" when not travelling. */
  here?: string;
  /** Makes landmarks clickable (Phase 2 teleport). */
  onSelectZone?: (zoneId: string) => void;
  reducedMotion?: boolean;
  className?: string;
}

/** Short place name for a label: "The Forge · Metal" → "The Forge". */
const placeName = (id: string) => (ZONES[id]?.name ?? id).split("·")[0]!.trim();

export function WorldMap({ from, to, progress, look, here, onSelectZone, reducedMotion = false, className }: WorldMapProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const props = useRef({ from, to, progress, look, here, reducedMotion });
  props.current = { from, to, progress, look, here, reducedMotion };

  useEffect(() => {
    const g = canvas.current?.getContext("2d");
    if (!g) return;
    const p = canvasPainter(g);
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const c = props.current;
      g.clearRect(0, 0, MAP_W, MAP_H);
      drawWorldMap(p, { t: (now - start) / 1000, motion: !c.reducedMotion, from: c.from, to: c.to, progress: c.progress?.(), look: c.look, here: c.here });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`world-map ${className ?? ""}`}>
      <canvas ref={canvas} width={MAP_W} height={MAP_H} role="img" aria-label="Map of the Earshot world" />
      {Object.values(LANDMARKS).map((L) => {
        const style = { left: `${(L.x / MAP_W) * 100}%`, top: `${((L.y + 4) / MAP_H) * 100}%` };
        const label = placeName(L.id);
        const lit = L.id === to || (!to && L.id === here);
        return onSelectZone ? (
          <button key={L.id} type="button" className={`world-map-label${lit ? " lit" : ""}`} style={style} onClick={() => onSelectZone(L.id)}>
            {label}
          </button>
        ) : (
          <span key={L.id} className={`world-map-label${lit ? " lit" : ""}`} style={style}>
            {label}
          </span>
        );
      })}
    </div>
  );
}
