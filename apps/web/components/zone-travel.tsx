"use client";

// Full-screen zone-travel overlay: fade to the world map, hop from the old zone to the new one,
// slam the title card, then hand off (onGo) to load the new zone. Reduced motion: crossfade + title.
import type { Look } from "@earshot/core";
import { useEffect, useRef, useState } from "react";
import { WorldMap } from "@/components/world-map";
import { hopProgress, phaseAt, type TravelPhase, timelineFor } from "@/lib/world/travel";
import { ZONES } from "@/lib/world/zones";

export function ZoneTravel({ from, to, look, onGo }: { from: string; to: string; look?: Look; onGo: () => void }) {
  // Read at the moment the trip starts, so a setting changed mid-visit is respected.
  const [reducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const tl = timelineFor(reducedMotion);
  const [phase, setPhase] = useState<TravelPhase>(phaseAt(tl, 0));
  const start = useRef(performance.now());
  const went = useRef(false);
  const onGoRef = useRef(onGo);
  onGoRef.current = onGo;

  // Phase changes run on timers, not animation frames: frames stop in background tabs, and a trip
  // started while you glance away should still finish. (The hop itself is drawn per frame.)
  useEffect(() => {
    const phases: TravelPhase[] = ["walk", "fade", "map", "title", "go"];
    const timers = phases.map((p) =>
      window.setTimeout(
        () => {
          setPhase(p);
          if (p === "go" && !went.current) {
            went.current = true;
            onGoRef.current();
          }
        },
        Math.max(0, tl[p] - (performance.now() - start.current)),
      ),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [tl]);

  const shown = phase !== "walk";
  return (
    <div className={`travel${shown ? " on" : ""}${reducedMotion ? " reduced" : ""}`} aria-live="polite">
      {!reducedMotion && (phase === "map" || phase === "title" || phase === "go") && (
        <WorldMap from={from} to={to} look={look} progress={() => hopProgress(tl, performance.now() - start.current)} className="travel-map" />
      )}
      {(phase === "title" || phase === "go") && <TitleCard zoneId={to} slam={!reducedMotion} />}
    </div>
  );
}

export function TitleCard({ zoneId, slam }: { zoneId: string; slam: boolean }) {
  return (
    <div className={`travel-title${slam ? " slam" : ""}`} role="status">
      {(ZONES[zoneId]?.name ?? zoneId).toUpperCase()}
    </div>
  );
}

/** On arrival: the title card stays up until the new zone is ready, then fades away. */
export function ArrivalCurtain({ zoneId, ready }: { zoneId: string; ready: boolean }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setGone(true), 450);
    return () => window.clearTimeout(t);
  }, [ready]);
  if (gone) return null;
  return (
    <div className={`travel on${ready ? " leaving" : ""}`}>
      <TitleCard zoneId={zoneId} slam={false} />
    </div>
  );
}
