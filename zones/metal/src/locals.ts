// The Forge's locals: people who live here. Scenery, not listeners: muted clothes, no names,
// never counted. Placed behind venue stages or well clear of their crowds.
import { box, drawPerson, type Frame, type Look, type Painter, type TilePoint, type ZoneLocal } from "@earshot/core";
import { iso } from "./scenery.ts";

/** Muted palette: dusty, low-contrast clothes and no bright print, so locals read as part of the place. */
const look = (skin: string, hair: string, shirt: string, pants: string, long = false): Look => ({ skin, hair, long, shirt, print: shirt, pants });
const SMITH = look("#b08a70", "#2a2220", "#4a3e38", "#2e2a2a");
const TENDER = look("#9a7058", "#3a302a", "#54463c", "#2a2626");
const HAULER = look("#c0a088", "#4a3a2a", "#5a4e44", "#343030");
const GAZER = look("#8a6450", "#1e1a18", "#3e3634", "#2a2828", true);
const WATCHER = look("#a88068", "#5a4a3e", "#4e4440", "#302c2c");
const SITTER = look("#b89880", "#6a5a4e", "#463e3a", "#2c2a2a", true);

const at = (x: number, y: number): TilePoint => [x, y];
function feet([x, y]: TilePoint): [number, number] {
  const [cx, cy] = iso(x, y);
  return [Math.round(cx), Math.round(cy)];
}
/** A seated figure: a stone or crate to sit on, and the person drawn a few pixels up. */
function seated(p: Painter, where: TilePoint, l: Look, f: Frame, k: number): void {
  box(p, iso, where[0] - 0.2, where[1] - 0.2, 0.45, 0.4, 3, "#3b302d", "#2f2523", "#251d1b");
  const [x, y] = feet(where);
  const bob = f.motion && Math.sin(f.t * 0.8 + k) > 0.85 ? 1 : 0;
  drawPerson(p, x, y - 3, l, bob, 0, false);
}

export function createLocals(): ZoneLocal[] {
  const smithAt = at(6.25, 5.85);
  const tenderAt = at(17.1, 4.75);
  const haulerLine: [number, number] = [1.8, 4.6];
  const haulerPos = (f: Frame): TilePoint =>
    f.motion ? at(haulerLine[0] + ((haulerLine[1] - haulerLine[0]) * (Math.sin(f.t * 0.32) + 1)) / 2, 7.35) : at(3.2, 7.35);
  const gazerAt = at(13, 3.65);
  return [
    {
      id: "blacksmith",
      at: smithAt,
      draw(p, f) {
        const [x, y] = feet(smithAt);
        const swing = f.motion ? Math.sin(f.t * 4.2) : 1;
        const up = swing > 0;
        drawPerson(p, x, y, SMITH, 0, 0, up);
        // Hammer head above the raised arm, down at the anvil on the strike.
        if (up) p.rect(x + 3, y - 13, 3, 2, "#6f625c");
        else p.rect(x + 4, y - 7, 3, 2, "#6f625c");
        // Sparks just after each strike.
        if (f.motion && swing < 0 && swing > -0.5) {
          const [ax, ay] = feet(at(5.95, 6.6));
          for (let k = 0; k < 3; k++) p.rect(ax + 2 + ((k * 3 + Math.floor(f.t * 20)) % 5) - 2, ay - 7 - k, 1, 1, k % 2 ? "#ffb347" : "#ff6a2b");
        }
      },
    },
    {
      id: "brazier-tender",
      at: tenderAt,
      draw(p, f) {
        const [x, y] = feet(tenderAt);
        const poke = f.motion ? Math.sin(f.t * 1.3) : 0;
        drawPerson(p, x, y, TENDER, poke > 0.6 ? 1 : 0, 0, false);
        // Poker reaching toward the brazier.
        const reach = Math.round(poke * 2);
        p.line(x - 3, y - 6, x - 8 - reach, y - 9, 1, "#5e514c");
      },
    },
    {
      id: "coal-hauler",
      at: at(3.2, 7.35),
      pos: haulerPos,
      draw(p, f) {
        const [x, y] = feet(haulerPos(f));
        const walking = f.motion && Math.abs(Math.cos(f.t * 0.32)) > 0.15;
        drawPerson(p, x, y, HAULER, 0, walking ? (Math.sin(f.t * 9) > 0 ? 1 : -1) : 0, false);
        p.rect(x - 4, y - 9, 3, 4, "#2a2220"); // coal sack on the back
      },
    },
    {
      id: "lava-gazer",
      at: gazerAt,
      draw(p, f) {
        const [x, y] = feet(gazerAt);
        drawPerson(p, x, y, GAZER, f.motion && Math.sin(f.t * 0.6) > 0.9 ? 1 : 0, 0, false);
        p.rect(x - 1, y - 9, 3, 1, "#ff6a2b", 0.25); // lava glow on the face
      },
    },
    { id: "watcher", at: at(30.3, 21.5), draw: (p, f) => seated(p, at(30.3, 21.5), WATCHER, f, 1) },
    { id: "sitter", at: at(1.4, 30.2), draw: (p, f) => seated(p, at(1.4, 30.2), SITTER, f, 2) },
  ];
}
