// PixiJS world renderer. The zone draws in art pixels (through PixiPainter) into a low-res
// RenderTexture, which is shown scaled up with nearest-neighbour filtering: the prototype's pixel look.
// Layout decisions come from core's World; this file only animates and draws them.
import { drawPerson, type Frame, makeIso, type Participant, type TilePoint, World, type ZonePlugin } from "@earshot/core";
import { Application, Container, RenderTexture, Sprite, Text, TextStyle } from "pixi.js";
import { PixiPainter } from "./painters";
import type { PersonSummary, PersonView, Selection, VenueSummary } from "./types";

export const TIER_LABEL = { busker: "Busker", tavern: "Tavern", amph: "Amphitheater", fest: "Festival" } as const;
const WALK_SPEED = 2.3; // tiles per second

interface Walker {
  view: PersonView;
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

export interface RendererOptions {
  reducedMotion: boolean;
  onSelect?: (sel: Selection) => void;
}

export class WorldRenderer {
  private readonly app: Application;
  private readonly zone: ZonePlugin;
  private readonly world: World;
  private readonly iso: ReturnType<typeof makeIso>;
  private readonly host: HTMLElement;
  private readonly opts: RendererOptions;

  private readonly rt: RenderTexture;
  private readonly scene = new Container();
  private readonly ground = new PixiPainter();
  private readonly dyn = new PixiPainter();
  private readonly view: Sprite;
  private readonly labels = new Container();
  private readonly venueLabels = new Map<string, { box: Text; sub: Text }>();
  private readonly tags = new Map<string, Text>();
  private plazaLabel: Text;

  private walkers = new Map<string, Walker>();
  private selection: Selection = null;
  private followId: string | null = null;
  private S = 3;
  private camX = 0;
  private camY = 0;
  private t = 0;
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
    this.world = new World(zone.layout);
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
    this.plazaLabel = this.makeText("", this.fonts.mono, 10, "#a39187");
    this.labels.addChild(this.plazaLabel);
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

  destroy(): void {
    for (const c of this.cleanup) c();
    this.app.destroy(true, { children: true, texture: true });
    this.rt.destroy(true);
  }

  // ---------------------------------------------------------------- people

  /** Replace the crowd. `initial` places everyone at their spot instantly (first load). */
  setPeople(people: PersonView[], initial = false): void {
    const participants: Participant[] = people.map((p) => ({ id: p.id, groupKey: p.groupKey, itemKey: p.itemKey }));
    this.world.update(participants, initial);
    const present = new Set<string>();
    for (const p of people) {
      present.add(p.id);
      let w = this.walkers.get(p.id);
      if (!w) {
        const [ex, ey] = initial ? [0, 0] : this.edgePoint();
        w = { view: p, x: ex, y: ey, tx: ex, ty: ey, moving: false, walkT: 0, phase: Math.random() * 6.28, tempo: 7 + Math.random() * 4, plazaWait: 0, leaving: false };
        this.walkers.set(p.id, w);
      }
      w.view = p;
      w.leaving = false;
      const pl = this.world.placement(p.id)!;
      if (pl.target) {
        [w.tx, w.ty] = pl.target;
      } else if (w.plazaWait <= 0 || !this.inPlaza(w.tx, w.ty)) {
        [w.tx, w.ty] = this.plazaSpot();
        w.plazaWait = 2 + Math.random() * 4;
      }
      if (initial) {
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

  venues(): VenueSummary[] {
    const people = [...this.walkers.values()].filter((w) => !w.leaving);
    return this.world.activeVenues().map((v) => {
      const members = people.filter((w) => w.view.groupKey === v.groupKey);
      const stage = members.find((w) => w.view.itemKey === v.stageItem);
      return {
        groupKey: v.groupKey,
        groupName: members[0]?.view.groupName ?? v.groupKey,
        count: v.count,
        tier: v.tier,
        slotted: v.slot >= 0,
        stageTitle: stage?.view.itemTitle ?? null,
        front: members.filter((w) => this.world.placement(w.view.id)?.kind === "front").length,
      };
    });
  }

  person(id: string): PersonSummary | null {
    const w = this.walkers.get(id);
    if (!w) return null;
    const pl = this.world.placement(id);
    const v = this.world.venues.get(w.view.groupKey);
    const tier = v ? TIER_LABEL[v.tier].toLowerCase() : "";
    const where = w.leaving
      ? "heading out"
      : !pl || pl.kind === "plaza"
        ? "in the plaza, waiting for a stage"
        : pl.kind === "front"
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
      const v = this.world.venues.get(sel.groupKey);
      if (v && v.slot >= 0) {
        const [sx, sy] = this.zone.layout.slots[v.slot]!;
        this.centerOn(sx + 1.5, sy + 1.5);
      } else this.centerOn((this.zone.layout.plaza.x0 + this.zone.layout.plaza.x1) / 2, (this.zone.layout.plaza.y0 + this.zone.layout.plaza.y1) / 2);
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
    this.S = Math.max(2, Math.min(5, Math.floor(Math.min(cw / 300, ch / 190))));
    const [fx, fy] = this.zone.layout.focus;
    this.centerOn(fx, fy);
  }

  private clampCam(): void {
    const { cw, ch } = this.size();
    const W = this.zone.layout.pixels.w * this.S;
    const H = this.zone.layout.pixels.h * this.S;
    const m = 60;
    this.camX = W < cw ? (cw - W) / 2 : Math.min(m, Math.max(cw - W - m, this.camX));
    this.camY = H < ch ? (ch - H) / 2 : Math.min(m, Math.max(ch - H - m, this.camY));
  }

  // ---------------------------------------------------------------- frame

  private frame(dt: number): void {
    this.t += dt;
    const f: Frame = { t: this.t, dt, motion: !this.opts.reducedMotion };
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
    const slotted = this.world.activeVenues().filter((v) => v.slot >= 0);
    for (const v of slotted) {
      const at = this.zone.layout.slots[v.slot]!;
      items.push({ d: at[0] + at[1], draw: () => this.zone.venueStyles[v.tier].draw(p, { slot: v.slot, at, tier: v.tier, count: v.count }, f) });
    }
    for (const w of this.walkers.values()) items.push({ d: w.x + w.y, draw: () => this.drawWalker(w, f) });
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
    const pl = this.world.placement(w.view.id);
    if (w.moving) walk = Math.sin(w.walkT * 14) > 0 ? 1 : -1;
    else if (f.motion && pl && pl.kind !== "plaza" && !w.leaving) {
      const front = pl.kind === "front";
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
        const st = Math.min(dist, WALK_SPEED * dt);
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
          if (this.selection?.type === "person" && this.selection.id === id) this.opts.onSelect?.(null);
          continue;
        }
        if (this.world.placement(id)?.kind === "plaza") {
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
    t.anchor.set(0.5, 1);
    t.resolution = Math.min(3, window.devicePixelRatio || 1);
    return t;
  }

  private drawLabels(slotted: ReturnType<World["activeVenues"]>): void {
    const toScreen = (lx: number, ly: number) => [this.camX + lx * this.S, this.camY + ly * this.S] as const;
    const summaries = new Map(this.venues().map((v) => [v.groupKey, v]));
    const seen = new Set<string>();
    for (const v of slotted) {
      const s = summaries.get(v.groupKey);
      if (!s) continue;
      seen.add(v.groupKey);
      let lbl = this.venueLabels.get(v.groupKey);
      if (!lbl) {
        lbl = { box: this.makeText("", this.fonts.display, 11, "#efe4d6", "700"), sub: this.makeText("", this.fonts.mono, 10, "#ffb347") };
        this.labels.addChild(lbl.box, lbl.sub);
        this.venueLabels.set(v.groupKey, lbl);
      }
      const big = v.tier === "fest";
      const [sx, sy] = this.zone.layout.slots[v.slot]!;
      const [lx, ly] = this.iso(sx, sy);
      const [x, y] = toScreen(lx, ly - this.zone.venueStyles[v.tier].labelLift - 8);
      lbl.box.text = s.groupName.toUpperCase();
      lbl.box.style.fontSize = big ? 15 : 11;
      lbl.sub.text = v.tier === "busker" ? "1 here" : `${v.count} here · ♪ ${s.stageTitle ?? ""}`;
      lbl.sub.style.fontSize = big ? 12 : 10;
      const selected = this.selection?.type === "venue" && this.selection.groupKey === v.groupKey;
      lbl.box.style.fill = selected ? "#ffb347" : "#efe4d6";
      lbl.box.position.set(Math.round(x), Math.round(y - (big ? 20 : 15)));
      lbl.sub.position.set(Math.round(x), Math.round(y - 2));
    }
    for (const [k, lbl] of this.venueLabels) {
      if (!seen.has(k)) {
        lbl.box.destroy();
        lbl.sub.destroy();
        this.venueLabels.delete(k);
      }
    }

    // Plaza count.
    const waiting = [...this.walkers.values()].filter((w) => !w.leaving && this.world.placement(w.view.id)?.kind === "plaza").length;
    const pz = this.zone.layout.plaza;
    const [plx, ply] = this.iso((pz.x0 + pz.x1) / 2, (pz.y0 + pz.y1) / 2);
    const [px, py] = toScreen(plx, ply - 20);
    this.plazaLabel.text = waiting ? `PLAZA · ${waiting} waiting for a stage` : "";
    this.plazaLabel.position.set(Math.round(px), Math.round(py));

    // Name tags: you, and whoever is selected.
    const tagged = new Set<string>();
    for (const w of this.walkers.values()) {
      const selected = this.selection?.type === "person" && this.selection.id === w.view.id;
      if (!w.view.you && !selected) continue;
      tagged.add(w.view.id);
      let tag = this.tags.get(w.view.id);
      if (!tag) {
        tag = this.makeText("", this.fonts.display, 10, "#1a0f0b", "700");
        this.labels.addChild(tag);
        this.tags.set(w.view.id, tag);
      }
      tag.text = w.view.you ? "YOU" : w.view.name;
      tag.style.fill = w.view.you ? "#efe4d6" : "#ffb347";
      const [lx, ly] = this.iso(w.x, w.y);
      const [x, y] = toScreen(lx, ly - 15);
      tag.position.set(Math.round(x), Math.round(y));
    }
    for (const [id, tag] of this.tags) {
      if (!tagged.has(id)) {
        tag.destroy();
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
    let sel: Selection = null;
    if (hit) sel = { type: "person", id: hit.view.id };
    else {
      let best = Infinity;
      for (const v of this.world.activeVenues()) {
        if (v.slot < 0) continue;
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

