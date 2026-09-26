// PixiJS world renderer. The zone draws in art pixels (through PixiPainter) into a low-res
// RenderTexture, which is shown scaled up with nearest-neighbour filtering: the prototype's pixel look.
// The layout (who stands at which spot) arrives as a Scene; this file only animates and draws it.
import { drawPerson, type Frame, localsToShow, makeIso, type Painter, spotFor, spotJitter, type TilePoint, type ZonePlugin } from "@earshot/core";
import { Application, Container, Graphics, RenderTexture, Sprite, Text, TextStyle } from "pixi.js";
import { clampCamera, defaultCamera } from "./camera";
import { PixiPainter } from "./painters";
import type { PlacedPerson, Scene, SceneVenue } from "./scene";
import type { PersonSummary, Selection } from "./types";

export const TIER_LABEL = { busker: "Busker", tavern: "Tavern", amph: "Amphitheater", fest: "Festival" } as const;
const WALK_SPEED = 2.3; // tiles per second
/** Your own avatar heading off to another zone walks this much faster, so the exit fits the transition. */
const HURRY = 3.2;

/** A painter that fades everything drawn through it (locals easing in and out). */
function faded(p: Painter, alpha: number): Painter {
  return {
    rect: (x, y, w, h, color, a = 1) => p.rect(x, y, w, h, color, a * alpha),
    poly: (pts, color, a = 1) => p.poly(pts, color, a * alpha),
    line: (x0, y0, x1, y1, width, color, a = 1) => p.line(x0, y0, x1, y1, width, color, a * alpha),
    glow: (pts, color, a) => p.glow(pts, color, a * alpha),
  };
}

interface Walker {
  view: PlacedPerson;
  x: number;
  y: number;
  tx: number;
  ty: number;
  moving: boolean;
  walkT: number;
  phase: number;
  tempo: number;
  plazaWait: number;
  leaving: boolean;
}

interface Label {
  root: Container;
  plate: Graphics;
  title: Text | null;
  sub: Text;
}

export interface RendererOptions {
  reducedMotion: boolean;
  onSelect?: (sel: Selection) => void;
}

export class WorldRenderer {
  private readonly app: Application;
  private readonly zone: ZonePlugin;
  private readonly iso: ReturnType<typeof makeIso>;
  private readonly host: HTMLElement;
  private readonly opts: RendererOptions;

  private readonly rt: RenderTexture;
  private readonly scene = new Container();
  private readonly ground = new PixiPainter();
  private readonly dyn = new PixiPainter();
  private readonly view: Sprite;
  /** Screen-space layer above the whole world texture: labels are never occluded by props or people. */
  private readonly labels = new Container();
  private readonly venueLabels = new Map<string, Label>();
  private readonly tags = new Map<string, Label>();
  private readonly plazaLabel: Label;

  private layout: Scene = { people: [], venues: [] };
  private walkers = new Map<string, Walker>();
  /** Walkers leaving for another zone (zone travel): hurried to the nearest edge, deaf to scene updates. */
  private readonly departing = new Set<string>();
  private selection: Selection = null;
  private followId: string | null = null;
  private S = 3;
  private camX = 0;
  private camY = 0;
  private t = 0;
  private lastFrame: Frame = { t: 0, dt: 0, motion: true };
  /** Ambient locals' current opacity (0..1), easing toward shown/hidden as the crowd changes. */
  private readonly localAlpha = new Map<string, number>();
  private fonts = { display: "Courier New", mono: "monospace" };
  private down: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
  private readonly cleanup: (() => void)[] = [];

  static async create(host: HTMLElement, zone: ZonePlugin, opts: RendererOptions): Promise<WorldRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: zone.theme.background,
      antialias: false,
      autoDensity: true,
      resolution: Math.min(3, window.devicePixelRatio || 1),
    });
    return new WorldRenderer(app, host, zone, opts);
  }

  private constructor(app: Application, host: HTMLElement, zone: ZonePlugin, opts: RendererOptions) {
    this.app = app;
    this.host = host;
    this.zone = zone;
    this.opts = opts;
    this.iso = makeIso(zone.layout.origin);

    const css = getComputedStyle(document.documentElement);
    this.fonts = {
      display: css.getPropertyValue("--font-display").trim() || "Courier New",
      mono: css.getPropertyValue("--font-mono").trim() || "monospace",
    };

    const { w, h } = zone.layout.pixels;
    this.rt = RenderTexture.create({ width: w, height: h, resolution: 1, scaleMode: "nearest" });
    zone.scenery.ground(this.ground);
    this.scene.addChild(this.ground.base, this.dyn.base, this.dyn.light);

    this.view = new Sprite(this.rt);
    this.view.roundPixels = true;
    this.plazaLabel = this.makeLabel(null, { family: this.fonts.mono, size: 10, fill: "#a39187" });
    // Order matters: the world texture first, every label after it.
    app.stage.addChild(this.view, this.labels);

    const canvas = app.canvas;
    canvas.style.display = "block";
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    canvas.setAttribute("aria-label", `Isometric ${zone.theme.name} with everyone listening right now`);
    canvas.setAttribute("role", "img");
    host.appendChild(canvas);

    this.fitInitial();
    this.bindInput(canvas);
    app.ticker.add((tk) => this.frame(Math.min(0.05, tk.deltaMS / 1000)));
    const ro = new ResizeObserver(() => this.clampCam());
    ro.observe(host);
    this.cleanup.push(() => ro.disconnect());
  }

  /** PNG data URL of the current view (world + labels), rendered on demand; works in background tabs. */
  async snapshot(): Promise<string> {
    this.frame(0); // draw the world now: animation frames pause in background tabs
    return this.app.renderer.extract.base64({ target: this.app.stage, frame: this.app.screen, clearColor: this.zone.theme.background, format: "png" });
  }

  destroy(): void {
    for (const c of this.cleanup) c();
    this.app.destroy(true, { children: true, texture: true });
    this.rt.destroy(true);
  }

  // ---------------------------------------------------------------- scene

  /**
   * Show a new layout. `initial` places everyone at their spot instantly (first load), except
   * `arriveId`, who walks in from the nearest edge (arriving from another zone).
   */
  setScene(scene: Scene, initial = false, arriveId: string | null = null): void {
    this.layout = scene;
    const tierOf = new Map(scene.venues.map((v) => [v.groupKey, v.tier]));
    const present = new Set<string>();
    for (const p of scene.people) {
      present.add(p.id);
      if (this.departing.has(p.id)) continue; // already walking off to another zone
      let w = this.walkers.get(p.id);
      const arriving = initial && p.id === arriveId && !w;
      if (!w) {
        const [ex, ey] = initial && !arriving ? [0, 0] : this.edgePoint();
        w = { view: p, x: ex, y: ey, tx: ex, ty: ey, moving: false, walkT: 0, phase: Math.random() * 6.28, tempo: 7 + Math.random() * 4, plazaWait: 0, leaving: false };
        this.walkers.set(p.id, w);
      }
      w.view = p;
      w.leaving = false;
      const at = p.slot === null ? undefined : this.zone.layout.slots[p.slot];
      if (p.kind !== "plaza" && at && p.index !== null) {
        [w.tx, w.ty] = spotFor(at, tierOf.get(p.groupKey) ?? "busker", p.kind, p.index, spotJitter(p.id), this.zone.layout.bounds);
      } else if (w.plazaWait <= 0 || !this.inPlaza(w.tx, w.ty)) {
        [w.tx, w.ty] = this.plazaSpot();
        w.plazaWait = 2 + Math.random() * 4;
      }
      if (arriving) {
        [w.x, w.y] = this.nearestEdge(w.tx, w.ty);
      } else if (initial) {
        w.x = w.tx;
        w.y = w.ty;
      }
    }
    for (const w of this.walkers.values()) {
      if (!present.has(w.view.id) && !w.leaving) {
        w.leaving = true;
        [w.tx, w.ty] = this.edgePoint();
      }
    }
  }

  // ---------------------------------------------------------------- queries for the side panel

  venues(): SceneVenue[] {
    return this.layout.venues;
  }

  person(id: string): PersonSummary | null {
    const w = this.walkers.get(id);
    if (!w) return null;
    const v = this.layout.venues.find((x) => x.groupKey === w.view.groupKey);
    const tier = v ? TIER_LABEL[v.tier].toLowerCase() : "";
    const where = w.leaving
      ? "heading out"
      : w.view.kind === "plaza"
        ? "in the plaza, waiting for a stage"
        : w.view.kind === "front"
          ? `front rows at the ${tier}`
          : `in the field at the ${tier}`;
    return { id, name: w.view.name, groupName: w.view.groupName, itemTitle: w.view.itemTitle, you: !!w.view.you, where };
  }

  // ---------------------------------------------------------------- selection & camera

  select(sel: Selection, focus = false): void {
    this.selection = sel;
    this.followId = null;
    if (!focus || !sel) return;
    if (sel.type === "venue") {
      const v = this.layout.venues.find((x) => x.groupKey === sel.groupKey);
      const at = v?.slot != null ? this.zone.layout.slots[v.slot] : undefined;
      if (at) this.centerOn(at[0] + 1.5, at[1] + 1.5);
      else {
        const pz = this.zone.layout.plaza;
        this.centerOn((pz.x0 + pz.x1) / 2, (pz.y0 + pz.y1) / 2);
      }
    } else {
      this.followId = sel.id;
    }
  }

  follow(id: string | null): void {
    this.followId = id;
  }

  get following(): string | null {
    return this.followId;
  }

  zoom(delta: number): void {
    const ns = Math.max(1, Math.min(6, this.S + delta));
    if (ns === this.S) return;
    const { cw, ch } = this.size();
    const wx = (cw / 2 - this.camX) / this.S;
    const wy = (ch / 2 - this.camY) / this.S;
    this.S = ns;
    this.camX = cw / 2 - wx * this.S;
    this.camY = ch / 2 - wy * this.S;
    this.clampCam();
  }

  centerOn(x: number, y: number): void {
    const [lx, ly] = this.iso(x, y);
    const { cw, ch } = this.size();
    this.camX = cw / 2 - lx * this.S;
    this.camY = ch / 2 - ly * this.S;
    this.clampCam();
  }

  private size() {
    return { cw: this.host.clientWidth, ch: this.host.clientHeight };
  }

  private fitInitial(): void {
    const { cw, ch } = this.size();
    ({ S: this.S, camX: this.camX, camY: this.camY } = defaultCamera(this.zone.layout, cw, ch));
  }

  private clampCam(): void {
    const { cw, ch } = this.size();
    ({ camX: this.camX, camY: this.camY } = clampCamera({ S: this.S, camX: this.camX, camY: this.camY }, this.zone.layout, cw, ch));
  }

  // ---------------------------------------------------------------- frame

  private slotted(): (SceneVenue & { slot: number })[] {
    return this.layout.venues.filter((v): v is SceneVenue & { slot: number } => v.slot !== null && !!this.zone.layout.slots[v.slot]);
  }

  private frame(dt: number): void {
    this.t += dt;
    const f: Frame = { t: this.t, dt, motion: !this.opts.reducedMotion };
    this.lastFrame = f;
    this.move(dt);

    if (this.followId) {
      const w = this.walkers.get(this.followId);
      if (w) {
        const [lx, ly] = this.iso(w.x, w.y);
        const { cw, ch } = this.size();
        const tx = cw / 2 - lx * this.S;
        const ty = ch / 2 - (ly - 10) * this.S;
        this.camX += (tx - this.camX) * Math.min(1, dt * 4);
        this.camY += (ty - this.camY) * Math.min(1, dt * 4);
        this.clampCam();
      } else this.followId = null;
    }

    // World, in art pixels.
    const p = this.dyn;
    p.clear();
    this.zone.scenery.underlay?.(p, f);
    const items: { d: number; draw: () => void }[] = [];
    for (const prop of this.zone.scenery.props) items.push({ d: prop.depth, draw: () => prop.draw(p, f) });
    const slotted = this.slotted();
    for (const v of slotted) {
      const at = this.zone.layout.slots[v.slot]!;
      items.push({ d: at[0] + at[1], draw: () => this.zone.venueStyles[v.tier].draw(p, { slot: v.slot, at, tier: v.tier, count: v.count }, f) });
    }
    for (const w of this.walkers.values()) items.push({ d: w.x + w.y, draw: () => this.drawWalker(w, f) });
    // Ambient locals: scenery, never part of the Scene or any count. Fewer as real people arrive.
    const locals = this.zone.locals ?? [];
    const shown = localsToShow(this.layout.people.length, locals.length);
    locals.forEach((l, i) => {
      const target = i < shown ? 1 : 0;
      const prev = this.localAlpha.get(l.id) ?? (this.t < 0.5 ? target : 0);
      const a = f.motion ? prev + Math.sign(target - prev) * Math.min(Math.abs(target - prev), dt * 1.25) : target;
      this.localAlpha.set(l.id, a);
      if (a <= 0.01) return;
      const [x, y] = l.pos?.(f) ?? l.at;
      items.push({ d: x + y, draw: () => l.draw(a < 0.99 ? faded(p, a) : p, f) });
    });
    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.draw();
    for (const v of slotted) {
      const at = this.zone.layout.slots[v.slot]!;
      this.zone.venueStyles[v.tier].overlay?.(p, { slot: v.slot, at, tier: v.tier, count: v.count }, f);
    }
    this.zone.scenery.overlay?.(p, f);
    this.app.renderer.render({ container: this.scene, target: this.rt, clear: true });

    // Scaled view + screen-space labels.
    this.view.position.set(Math.round(this.camX), Math.round(this.camY));
    this.view.scale.set(this.S);
    this.drawLabels(slotted);
  }

  private drawWalker(w: Walker, f: Frame): void {
    const [cx, cy] = this.iso(w.x, w.y);
    const selected = this.selection?.type === "person" && this.selection.id === w.view.id;
    if (selected || w.view.you) {
      const c = w.view.you ? "#efe4d6" : "#ffb347";
      const x = Math.round(cx);
      const y = Math.round(cy);
      this.dyn.rect(x - 4, y, 2, 1, c);
      this.dyn.rect(x + 3, y, 2, 1, c);
      this.dyn.rect(x - 1, y + 2, 3, 1, c);
      this.dyn.rect(x - 1, y - 13, 3, 1, c);
    }
    let bob = 0;
    let walk = 0;
    let arms = false;
    if (w.moving) walk = Math.sin(w.walkT * 14) > 0 ? 1 : -1;
    else if (f.motion && w.view.kind !== "plaza" && !w.leaving) {
      const front = w.view.kind === "front";
      bob = Math.sin(f.t * (front ? w.tempo + 2 : w.tempo * 0.6) + w.phase) > 0.3 ? 1 : 0;
      arms = front && Math.sin(f.t * 0.7 + w.phase * 3) > 0.55;
    }
    drawPerson(this.dyn, cx, cy, w.view.look, bob, walk, arms);
  }

  private move(dt: number): void {
    for (const [id, w] of this.walkers) {
      const dx = w.tx - w.x;
      const dy = w.ty - w.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.04) {
        const st = Math.min(dist, WALK_SPEED * (this.departing.has(id) ? HURRY : 1) * dt);
        w.x += (dx / dist) * st;
        w.y += (dy / dist) * st;
        w.moving = true;
        w.walkT += dt;
      } else {
        w.x = w.tx;
        w.y = w.ty;
        w.moving = false;
        if (w.leaving) {
          this.walkers.delete(id);
          this.departing.delete(id);
          if (this.selection?.type === "person" && this.selection.id === id) this.opts.onSelect?.(null);
          continue;
        }
        if (w.view.kind === "plaza") {
          w.plazaWait -= dt;
          if (w.plazaWait <= 0) {
            [w.tx, w.ty] = this.plazaSpot();
            w.plazaWait = 3 + Math.random() * 5;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- labels

  private makeText(text: string, family: string, size: number, fill: string, weight: "500" | "700" = "500"): Text {
    const t = new Text({ text, style: new TextStyle({ fontFamily: family, fontSize: size, fill, fontWeight: weight }) });
    t.anchor.set(0.5, 0);
    t.resolution = Math.min(3, window.devicePixelRatio || 1);
    return t;
  }

  /** A label on its own dark plate (prototype style), so it reads over any scenery. */
  private makeLabel(title: { family: string; size: number; fill: string } | null, sub: { family: string; size: number; fill: string }): Label {
    const root = new Container();
    const plate = new Graphics();
    const titleText = title ? this.makeText("", title.family, title.size, title.fill, "700") : null;
    const subText = this.makeText("", sub.family, sub.size, sub.fill, title ? "500" : "700");
    root.addChild(plate, ...(titleText ? [titleText] : []), subText);
    this.labels.addChild(root);
    return { root, plate, title: titleText, sub: subText };
  }

  private destroyLabel(l: Label): void {
    l.root.destroy({ children: true });
  }

  private drawLabels(slotted: (SceneVenue & { slot: number })[]): void {
    const toScreen = (lx: number, ly: number) => [this.camX + lx * this.S, this.camY + ly * this.S] as const;
    const seen = new Set<string>();
    for (const v of slotted) {
      seen.add(v.groupKey);
      let lbl = this.venueLabels.get(v.groupKey);
      if (!lbl) {
        lbl = this.makeLabel({ family: this.fonts.display, size: 11, fill: "#efe4d6" }, { family: this.fonts.mono, size: 10, fill: "#ffb347" });
        this.venueLabels.set(v.groupKey, lbl);
      }
      const big = v.tier === "fest";
      const selected = this.selection?.type === "venue" && this.selection.groupKey === v.groupKey;
      const [sx, sy] = this.zone.layout.slots[v.slot]!;
      const [lx, ly] = this.iso(sx, sy);
      const [x, y] = toScreen(lx, ly - this.zone.venueStyles[v.tier].labelLift - 8);
      const title = lbl.title!;
      title.text = v.groupName.toUpperCase();
      title.style.fontSize = big ? 15 : 11;
      title.style.fill = selected ? "#ffb347" : "#efe4d6";
      lbl.sub.text = v.tier === "busker" ? `1 here${v.stageTitle ? ` · ♪ ${v.stageTitle}` : ""}` : `${v.count} here · ♪ ${v.stageTitle ?? ""}`;
      lbl.sub.style.fontSize = big ? 12 : 10;
      const w = Math.ceil(Math.max(title.width, lbl.sub.width) + 16);
      const h = big ? 44 : 34;
      const bx = Math.round(x - w / 2);
      const by = Math.round(y - h);
      lbl.plate
        .clear()
        .rect(bx, by, w, h)
        .fill({ color: "#0e0a09", alpha: 0.86 })
        .rect(bx + 0.5, by + 0.5, w - 1, h - 1)
        .stroke({ width: selected || big ? 2 : 1, color: selected ? "#ffb347" : big ? this.zone.theme.accent : "#4a3834" });
      title.position.set(Math.round(x), by + 5);
      lbl.sub.position.set(Math.round(x), by + (big ? 25 : 19));
    }
    for (const [k, lbl] of this.venueLabels) {
      if (!seen.has(k)) {
        this.destroyLabel(lbl);
        this.venueLabels.delete(k);
      }
    }

    // Plaza count.
    const waiting = [...this.walkers.values()].filter((w) => !w.leaving && w.view.kind === "plaza").length;
    const pz = this.zone.layout.plaza;
    const [plx, ply] = this.iso((pz.x0 + pz.x1) / 2, (pz.y0 + pz.y1) / 2);
    const [px, py] = toScreen(plx, ply - 20);
    this.plazaLabel.root.visible = waiting > 0;
    if (waiting) {
      this.plazaLabel.sub.text = `PLAZA · ${waiting} waiting for a stage`;
      const w = Math.ceil(this.plazaLabel.sub.width + 12);
      this.plazaLabel.plate.clear().rect(Math.round(px - w / 2), Math.round(py - 16), w, 16).fill({ color: "#0e0a09", alpha: 0.8 });
      this.plazaLabel.sub.position.set(Math.round(px), Math.round(py - 14));
    }

    // Name tags: you, and whoever is selected. Colored plate, dark text.
    const tagged = new Set<string>();
    for (const w of this.walkers.values()) {
      const selected = this.selection?.type === "person" && this.selection.id === w.view.id;
      if (!w.view.you && !selected) continue;
      tagged.add(w.view.id);
      let tag = this.tags.get(w.view.id);
      if (!tag) {
        tag = this.makeLabel(null, { family: this.fonts.display, size: 10, fill: "#1a0f0b" });
        this.tags.set(w.view.id, tag);
      }
      tag.sub.text = w.view.you ? "YOU" : w.view.name;
      const [lx, ly] = this.iso(w.x, w.y);
      const [x, y] = toScreen(lx, ly - 15);
      const tw = Math.ceil(tag.sub.width + 10);
      tag.plate.clear().rect(Math.round(x - tw / 2), Math.round(y - 14), tw, 14).fill(w.view.you ? "#efe4d6" : "#ffb347");
      tag.sub.position.set(Math.round(x), Math.round(y - 13));
    }
    for (const [id, tag] of this.tags) {
      if (!tagged.has(id)) {
        this.destroyLabel(tag);
        this.tags.delete(id);
      }
    }
  }

  // ---------------------------------------------------------------- input

  private bindInput(canvas: HTMLCanvasElement): void {
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      canvas.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => canvas.removeEventListener(type, fn as EventListener));
    };
    on("pointerdown", (e) => {
      this.down = { x: e.clientX, y: e.clientY, cx: this.camX, cy: this.camY, moved: false };
      canvas.setPointerCapture(e.pointerId);
    });
    on("pointermove", (e) => {
      if (!this.down) return;
      const dx = e.clientX - this.down.x;
      const dy = e.clientY - this.down.y;
      if (!this.down.moved && Math.hypot(dx, dy) > 5) {
        this.down.moved = true;
        this.followId = null;
        canvas.style.cursor = "grabbing";
      }
      if (this.down.moved) {
        this.camX = this.down.cx + dx;
        this.camY = this.down.cy + dy;
        this.clampCam();
      }
    });
    on("pointerup", (e) => {
      if (!this.down) return;
      const tap = !this.down.moved;
      this.down = null;
      canvas.style.cursor = "grab";
      if (tap) this.tapAt(e.clientX, e.clientY);
    });
    on("pointercancel", () => {
      this.down = null;
      canvas.style.cursor = "grab";
    });
    on(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoom(e.deltaY < 0 ? 1 : -1);
      },
      { passive: false },
    );
  }

  private tapAt(clientX: number, clientY: number): void {
    const r = this.host.getBoundingClientRect();
    const lx = (clientX - r.left - this.camX) / this.S;
    const ly = (clientY - r.top - this.camY) / this.S;
    let hit: Walker | null = null;
    let hd = -Infinity;
    for (const w of this.walkers.values()) {
      const [cx, cy] = this.iso(w.x, w.y);
      if (lx >= cx - 4 && lx <= cx + 4 && ly >= cy - 13 && ly <= cy + 2 && w.x + w.y > hd) {
        hd = w.x + w.y;
        hit = w;
      }
    }
    // Locals can be tapped too (they only ever say "Local · lives here").
    let localHit: string | null = null;
    for (const l of this.zone.locals ?? []) {
      if ((this.localAlpha.get(l.id) ?? 0) < 0.5) continue;
      const [x, y] = l.pos?.(this.lastFrame) ?? l.at;
      const [cx, cy] = this.iso(x, y);
      if (lx >= cx - 5 && lx <= cx + 5 && ly >= cy - 14 && ly <= cy + 2 && x + y > hd) {
        hd = x + y;
        localHit = l.id;
      }
    }
    let sel: Selection = null;
    if (localHit) sel = { type: "local", id: localHit };
    else if (hit) sel = { type: "person", id: hit.view.id };
    else {
      let best = Infinity;
      for (const v of this.slotted()) {
        const [sx, sy] = this.zone.layout.slots[v.slot]!;
        const [cx, cy] = this.iso(sx, sy);
        const d = Math.hypot(lx - cx, ly - (cy - 8));
        if (d < this.zone.venueStyles[v.tier].reach && d < best) {
          best = d;
          sel = { type: "venue", groupKey: v.groupKey };
        }
      }
    }
    this.selection = sel;
    this.followId = null;
    this.opts.onSelect?.(sel);
  }

  // ---------------------------------------------------------------- geometry helpers

  /** Zone travel: send this person to the nearest edge now, hurried, whatever the next scene says. */
  depart(id: string): void {
    const w = this.walkers.get(id);
    if (!w) return;
    this.departing.add(id);
    w.leaving = true;
    [w.tx, w.ty] = this.nearestEdge(w.x, w.y);
  }

  /** The point on any spawn edge closest to (x, y). */
  private nearestEdge(x: number, y: number): TilePoint {
    let best: TilePoint = this.edgePoint();
    let bestD = Infinity;
    for (const e of this.zone.layout.spawnEdges) {
      const [ax, ay] = e.from;
      const [bx, by] = e.to;
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const u = Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2));
      const px = ax + (bx - ax) * u;
      const py = ay + (by - ay) * u;
      const d = Math.hypot(px - x, py - y);
      if (d < bestD) {
        bestD = d;
        best = [px, py];
      }
    }
    return best;
  }

  private edgePoint(): TilePoint {
    const edges = this.zone.layout.spawnEdges;
    const e = edges[Math.floor(Math.random() * edges.length)]!;
    const u = Math.random();
    return [e.from[0] + (e.to[0] - e.from[0]) * u, e.from[1] + (e.to[1] - e.from[1]) * u];
  }

  private plazaSpot(): TilePoint {
    const p = this.zone.layout.plaza;
    return [p.x0 + Math.random() * (p.x1 - p.x0), p.y0 + Math.random() * (p.y1 - p.y0)];
  }

  private inPlaza(x: number, y: number): boolean {
    const p = this.zone.layout.plaza;
    return x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1;
  }
}
