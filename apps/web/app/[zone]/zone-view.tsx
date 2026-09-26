"use client";

import type { Look } from "@earshot/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrivalCurtain, ZoneTravel } from "@/components/zone-travel";
import { DEFAULT_AVATAR, lookOf, parseAvatar } from "@/lib/avatar";
import type { WorldRenderer } from "@/lib/world/renderer";
import type { SceneVenue } from "@/lib/world/scene";
import type { PersonSummary, Selection } from "@/lib/world/types";
import { travelMode } from "@/lib/world/travel";
import { isZoneId, zoneHref, ZONES } from "@/lib/world/zones";

const TIER_LABEL = { busker: "Busker", tavern: "Tavern", amph: "Amphitheater", fest: "Festival" } as const;
const TIER_CHIP = { busker: "", tavern: "t-tavern", amph: "t-amph", fest: "t-fest" } as const;

export function ZoneView({
  zoneId,
  simSize,
  viewerId,
  welcome = false,
  arrive = false,
  travelDemo = null,
}: {
  zoneId: string;
  simSize: number | null;
  viewerId: string | null;
  welcome?: boolean;
  /** Arriving from another zone: title card until ready, then walk in from the edge. */
  arrive?: boolean;
  /** Sim only: play the travel transition to this zone after a moment (for previews). */
  travelDemo?: string | null;
}) {
  const router = useRouter();
  const [travel, setTravel] = useState<{ from: string; to: string; look: Look } | null>(null);
  const [toast, setToast] = useState<{ name: string; to: string } | null>(null);
  const [arrived, setArrived] = useState(!arrive);
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<WorldRenderer | null>(null);
  const [venues, setVenues] = useState<SceneVenue[]>([]);
  const [live, setLive] = useState(simSize !== null);
  const [selection, setSelection] = useState<Selection>(null);
  const [person, setPerson] = useState<PersonSummary | null>(null);
  const [following, setFollowing] = useState<string | null>(null);
  const zone = ZONES[zoneId]!;

  // Boot the renderer (client only), then feed it either live presence or a simulated crowd.
  useEffect(() => {
    let cancelled = false;
    let stop = () => {};
    (async () => {
      const [{ WorldRenderer }, scene, { World }] = await Promise.all([
        import("@/lib/world/renderer"),
        import("@/lib/world/scene"),
        import("@earshot/core"),
      ]);
      if (cancelled || !host.current) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const plugin = zone.create();
      const r = await WorldRenderer.create(host.current, plugin, { reducedMotion, onSelect: (sel) => setSelection(sel) });
      if (cancelled) return r.destroy();
      renderer.current = r;

      if (simSize !== null) {
        // Sim: lay the crowd out locally with the same core World the server uses.
        const { CrowdSim } = await import("@/lib/world/sim");
        const sim = new CrowdSim(simSize, zone.sim);
        const world = new World(plugin.layout);
        r.setScene(scene.sceneFromWorld(world, sim.people(), true), true);
        setArrived(true);
        let last = performance.now();
        const id = window.setInterval(() => {
          const now = performance.now();
          if (sim.step((now - last) / 1000)) r.setScene(scene.sceneFromWorld(world, sim.people()));
          last = now;
        }, 400);
        const demo = travelDemo && isZoneId(travelDemo) && travelDemo !== zoneId ? travelDemo : null;
        const demoTimer = demo ? window.setTimeout(() => setTravel({ from: zoneId, to: demo, look: lookOf(DEFAULT_AVATAR) }), 1500) : 0;
        stop = () => {
          window.clearInterval(id);
          window.clearTimeout(demoTimer);
        };
      } else {
        // Live: the server lays everyone out; mirror its presence rows.
        const { currentSelfZone, subscribeSelf, subscribeZone } = await import("@/lib/world/presence-feed");
        let foundYou = false;
        // Where your own avatar is, so a move to another zone can be told apart from other changes.
        let selfZone: string | null = null;
        const stopZone = subscribeZone(zoneId, (rows, initial) => {
          r.setScene(scene.sceneFromPresence(rows, viewerId), initial, initial && arrive ? viewerId : null);
          setLive(true);
          if (initial) setArrived(true);
          if (viewerId && rows.some((x) => x.user_id === viewerId)) {
            selfZone = zoneId;
            if (!foundYou) {
              foundYou = true; // follow yourself the first time you show up
              r.select({ type: "person", id: viewerId }, true);
              setSelection({ type: "person", id: viewerId });
            }
          }
        });
        let stopSelf = () => {};
        if (viewerId) {
          void currentSelfZone(viewerId).then((z) => {
            if (selfZone === null) selfZone = z;
          });
          stopSelf = subscribeSelf(viewerId, (row) => {
            const from = selfZone;
            selfZone = row.zone_id;
            if (!isZoneId(row.zone_id)) return;
            const mode = travelMode({ viewedZone: zoneId, fromZone: from, toZone: row.zone_id, followingSelf: r.following === viewerId });
            if (mode === "transition" && from) {
              r.depart(viewerId); // walk off to the nearest edge, camera following
              setTravel({ from, to: row.zone_id, look: lookOf(parseAvatar(row.avatar)) });
            } else if (mode === "toast") {
              setToast({ name: row.display_name || "You", to: row.zone_id });
            }
          });
        }
        stop = () => {
          stopZone();
          stopSelf();
        };
      }
    })();
    return () => {
      cancelled = true;
      stop();
      renderer.current?.destroy();
      renderer.current = null;
    };
  }, [zone, zoneId, simSize, viewerId, arrive, travelDemo]);

  // Arriving: drop ?arrive from the URL so a reload doesn't replay it.
  useEffect(() => {
    if (!arrive) return;
    const u = new URL(window.location.href);
    u.searchParams.delete("arrive");
    window.history.replaceState(null, "", u.pathname + u.search);
  }, [arrive]);

  // Toasts fade on their own.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 10_000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const goTo = useCallback(
    (to: string) => {
      const q = new URLSearchParams({ arrive: "1" });
      if (simSize !== null) q.set("sim", String(simSize));
      router.push(`${zoneHref(to)}?${q}`);
    },
    [router, simSize],
  );

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
    <div className={welcome ? "zone-app has-welcome" : "zone-app"}>
      {travel && <ZoneTravel from={travel.from} to={travel.to} look={travel.look} onGo={() => goTo(travel.to)} />}
      {arrive && <ArrivalCurtain zoneId={zoneId} ready={arrived} />}
      {toast && (
        <div className="toast" role="status">
          <span>
            {toast.name} headed to {ZONES[toast.to]!.name}
          </span>
          <button className="btn" onClick={() => goTo(toast.to)}>
            Follow
          </button>
          <button className="linkish" aria-label="Dismiss" onClick={() => setToast(null)}>
            {"\u2715"}
          </button>
        </div>
      )}
      <header className="zone-bar">
        <Link href="/world" className="brand small" aria-label="Earshot: go to the world">
          EAR<span>SHOT</span>
        </Link>
        <div className="zone-name">{zone.name}</div>
        <div className="live">{total} listening now</div>
        {simSize !== null && <div className="proto">Simulated crowd</div>}
        <Link href={viewerId ? "/me" : "/login"} className="you-link">
          {viewerId ? "You" : "Sign in"}
        </Link>
      </header>

      {welcome && (
        <p className="welcome" role="status">
          You&rsquo;re in. Play something on Last.fm and your avatar walks to that artist&rsquo;s venue.{" "}
          <Link href="/me">Pick your look</Link>
        </p>
      )}

      <main className="zone-stage">
        <div ref={host} className="zone-canvas" />
        {simSize === null && live && total === 0 && (
          <div className="zone-empty">
            Nobody&rsquo;s here right now.{" "}
            {viewerId ? (
              <>Play something on Last.fm and you&rsquo;ll walk in.</>
            ) : (
              <>
                <a href="/api/auth/lastfm/start">Sign in with Last.fm</a> and play something.
              </>
            )}
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
                <span className={`chip ${venue.slot !== null ? TIER_CHIP[venue.tier] : "t-wait"}`}>{venue.slot !== null ? TIER_LABEL[venue.tier] : "No stage yet"}</span>
              </div>
              {venue.slot !== null ? (
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
                    <span className={`chip ${v.slot !== null ? TIER_CHIP[v.tier] : "t-wait"}`}>{v.slot !== null ? TIER_LABEL[v.tier] : "No stage yet"}</span>
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
