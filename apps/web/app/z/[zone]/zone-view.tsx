"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorldRenderer } from "@/lib/world/renderer";
import type { PersonSummary, Selection, VenueSummary } from "@/lib/world/types";
import { ZONES } from "@/lib/world/zones";

const TIER_LABEL = { busker: "Busker", tavern: "Tavern", amph: "Amphitheater", fest: "Festival" } as const;
const TIER_CHIP = { busker: "", tavern: "t-tavern", amph: "t-amph", fest: "t-fest" } as const;

export function ZoneView({ zoneId, simSize }: { zoneId: string; simSize: number | null }) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<WorldRenderer | null>(null);
  const [venues, setVenues] = useState<VenueSummary[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [person, setPerson] = useState<PersonSummary | null>(null);
  const [following, setFollowing] = useState<string | null>(null);
  const zone = ZONES[zoneId]!;

  // Boot the renderer (client only) and, in sim mode, drive it with a simulated crowd.
  useEffect(() => {
    let cancelled = false;
    let stopSim = () => {};
    (async () => {
      const [{ WorldRenderer }, { CrowdSim }] = await Promise.all([import("@/lib/world/renderer"), import("@/lib/world/sim")]);
      if (cancelled || !host.current) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const r = await WorldRenderer.create(host.current, zone.create(), { reducedMotion, onSelect: (sel) => setSelection(sel) });
      if (cancelled) return r.destroy();
      renderer.current = r;
      if (simSize !== null) {
        const sim = new CrowdSim(simSize);
        r.setPeople(sim.people(), true);
        let last = performance.now();
        const id = window.setInterval(() => {
          const now = performance.now();
          if (sim.step((now - last) / 1000)) r.setPeople(sim.people());
          last = now;
        }, 400);
        stopSim = () => window.clearInterval(id);
      }
    })();
    return () => {
      cancelled = true;
      stopSim();
      renderer.current?.destroy();
      renderer.current = null;
    };
  }, [zone, simSize]);

  // The side panel reads the renderer twice a second.
  useEffect(() => {
    const id = window.setInterval(() => {
      const r = renderer.current;
      if (!r) return;
      setVenues(r.venues());
      setPerson(selection?.type === "person" ? r.person(selection.id) : null);
      setFollowing(r.following);
    }, 500);
    return () => window.clearInterval(id);
  }, [selection]);

  const choose = useCallback((sel: Selection, focus: boolean) => {
    setSelection(sel);
    renderer.current?.select(sel, focus);
    if (sel?.type === "person") setPerson(renderer.current?.person(sel.id) ?? null);
  }, []);

  const total = venues.reduce((s, v) => s + v.count, 0);
  const max = venues[0]?.count ?? 1;
  const venue = selection?.type === "venue" ? venues.find((v) => v.groupKey === selection.groupKey) : undefined;

  return (
    <div className="zone-app">
      <header className="zone-bar">
        <Link href="/" className="brand small">
          EAR<span>SHOT</span>
        </Link>
        <div className="zone-name">{zone.name}</div>
        <div className="live">{total} listening now</div>
        {simSize !== null && <div className="proto">Simulated crowd</div>}
      </header>

      <main className="zone-stage">
        <div ref={host} className="zone-canvas" />
        {simSize === null && total === 0 && (
          <div className="zone-empty">
            Nobody&rsquo;s here right now. <Link href="/me">Connect Last.fm</Link> and play something heavy.
          </div>
        )}
        <div className="zone-hint">Drag to look around. Tap anyone.</div>
        <div className="zone-zoom">
          <button aria-label="Zoom out" onClick={() => renderer.current?.zoom(-1)}>
            &minus;
          </button>
          <button aria-label="Zoom in" onClick={() => renderer.current?.zoom(1)}>
            +
          </button>
        </div>
      </main>

      <aside className="zone-panel">
        <section className="card inspect" aria-live="polite">
          <h2>Inspector</h2>
          {person ? (
            <>
              <div className="who">{person.you ? "You" : person.name}</div>
              <div>
                <div className="track">{person.itemTitle}</div>
                <div className="artist">{person.groupName}</div>
              </div>
              <div className="where">{person.where}</div>
              <div className="row">
                <button
                  className="btn"
                  onClick={() => {
                    const next = following === person.id ? null : person.id;
                    renderer.current?.follow(next);
                    setFollowing(next);
                  }}
                >
                  {following === person.id ? "Stop following" : "Follow"}
                </button>
              </div>
            </>
          ) : venue ? (
            <>
              <div className="who">{venue.groupName}</div>
              <div className="row">
                <span className={`chip ${venue.slotted ? TIER_CHIP[venue.tier] : "t-wait"}`}>{venue.slotted ? TIER_LABEL[venue.tier] : "No stage yet"}</span>
              </div>
              {venue.slotted ? (
                <>
                  <div>
                    <div className="track">♪ {venue.stageTitle}</div>
                    <div className="where">on stage now</div>
                  </div>
                  <div className="where">
                    {venue.count} listening · {venue.front} in the front rows · {venue.count - venue.front} in the field
                  </div>
                </>
              ) : (
                <div className="where">{venue.count} listening, waiting in the plaza until a stage frees up</div>
              )}
            </>
          ) : (
            <p className="note">Tap an avatar to see what they&rsquo;re playing, or tap a stage.</p>
          )}
        </section>

        <section className="card">
          <h2>Venues right now</h2>
          {venues.length === 0 ? (
            <p className="note">No venues yet.</p>
          ) : (
            <ol className="venues">
              {venues.map((v) => (
                <li key={v.groupKey}>
                  <button className={venue?.groupKey === v.groupKey ? "on" : ""} onClick={() => choose({ type: "venue", groupKey: v.groupKey }, true)}>
                    <span className="vname">{v.groupName}</span>
                    <span className={`chip ${v.slotted ? TIER_CHIP[v.tier] : "t-wait"}`}>{v.slotted ? TIER_LABEL[v.tier] : "No stage yet"}</span>
                    <span className="vcount">{v.count}</span>
                    <span className="meter">
                      <i style={{ width: `${((v.count / max) * 100).toFixed(1)}%` }} />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <p className="note">
            <b>Front rows</b> are on the same song as the stage. <b>The field</b> is playing other songs by that artist.
          </p>
        </section>

        <section className="card">
          <h2>Venue ladder</h2>
          <div className="ladder-grid">
            <span className="chip">Busker</span>
            <span className="n">1 listener</span>
            <span className="chip t-tavern">Tavern</span>
            <span className="n">2 to 9</span>
            <span className="chip t-amph">Amphitheater</span>
            <span className="n">10 to 49</span>
            <span className="chip t-fest">Festival</span>
            <span className="n">50+</span>
          </div>
        </section>
      </aside>
    </div>
  );
}
