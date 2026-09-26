// The Forge's locals: people who live here, where the eye goes (forge door, plaza, behind venues).
// Not listeners: no chest print, no name tag, no ring; never counted. Order matters: the first two
// stay longest as the zone fills up.
import { drawPerson, type Frame, type Look, loopAt, type Painter, type TilePoint, type ZoneLocal } from "@earshot/core";
import { brazier, iso } from "./scenery.ts";

/** Everyday working clothes at listener brightness; the chest print matches the shirt (no accent). */
const look = (skin: string, hair: string, shirt: string, pants: string, long = false): Look => ({ skin, hair, long, shirt, print: shirt, pants });
const SMITH = look("#d9a47c", "#15100e", "#6e4a34", "#2e2a2c");
const TENDER = look("#b57a52", "#2b1d15", "#4a5a6e", "#26262e");
const APPRENTICE = look("#f1c7a5", "#8b6a3e", "#7a5a30", "#2e3040", true);
const HAULER = look("#8a5634", "#15100e", "#4e5e3a", "#2a2a30");
const PACER = look("#e8b896", "#5a3a1e", "#6e3a3a", "#23283a");
const SITTER = look("#d9a47c", "#c9b18a", "#3a4a6e", "#2a2320", true);

const at = (x: number, y: number): TilePoint => [x, y];
const feet = ([x, y]: TilePoint): [number, number] => {
  const [cx, cy] = iso(x, y);
  return [Math.round(cx), Math.round(cy)];
};
/** A walking person: legs swing while moving; standing still with reduced motion. */
function walker(p: Painter, where: TilePoint, l: Look, f: Frame): void {
  const [x, y] = feet(where);
  drawPerson(p, x, y, l, 0, f.motion ? (Math.sin(f.t * 9) > 0 ? 1 : -1) : 0, false);
}

export function createLocals(): ZoneLocal[] {
  const smithAt = at(4.75, 6.8);
  const tenderLoop: TilePoint[] = [at(6.0, 8.8), at(6.0, 11.9), at(4.2, 13.2), at(6.0, 11.9)];
  const tenderPos = (f: Frame) => (f.motion ? loopAt(tenderLoop, 0.55, f.t) : tenderLoop[0]!);
  const apprenticeLoop: TilePoint[] = [at(2.4, 9.3), at(4.6, 9.6), at(4.3, 11.6), at(2.6, 11.2)];
  const apprenticePos = (f: Frame) => (f.motion ? loopAt(apprenticeLoop, 0.4, f.t + 3) : apprenticeLoop[0]!);
  const haulerLoop: TilePoint[] = [at(6.1, 7.3), at(8.2, 5.9)];
  const haulerPos = (f: Frame) => (f.motion ? loopAt(haulerLoop, 0.45, f.t) : haulerLoop[0]!);
  const pacerLoop: TilePoint[] = [at(18.6, 16.4), at(19.9, 15.9), at(19.4, 17.2)];
  const pacerPos = (f: Frame) => (f.motion ? loopAt(pacerLoop, 0.35, f.t + 1) : pacerLoop[0]!);
  const sitterAt = at(7.0, 18.7);

  return [
    {
      id: "blacksmith",
      at: smithAt,
      draw(p, f) {
        const [x, y] = feet(smithAt);
        const swing = f.motion ? Math.sin(f.t * 4.2) : 1;
        const up = swing > 0;
        drawPerson(p, x, y, SMITH, 0, 0, up);
        p.rect(x - 2, y - 6, 5, 3, "#3a2a22"); // leather apron
        // Hammer raised, then down on the anvil (to the smith's left) with a shower of sparks.
        if (up) p.rect(x - 5, y - 14, 3, 2, "#8a7e78");
        else p.rect(x - 7, y - 8, 3, 2, "#8a7e78");
        if (f.motion && swing < 0 && swing > -0.6) {
          const [ax, ay] = feet(at(4.1, 6.65));
          const k0 = Math.floor(f.t * 24);
          for (let k = 0; k < 5; k++) p.rect(ax - 3 + ((k0 + k * 7) % 7), ay - 7 - ((k0 + k * 3) % 5), 1, 1, k % 2 ? "#ffe1a0" : "#ff6a2b");
        }
      },
    },
    {
      id: "brazier-tender",
      at: tenderLoop[0]!,
      pos: tenderPos,
      draw(p, f) {
        const here = tenderPos(f);
        walker(p, here, TENDER, f);
        const [x, y] = feet(here);
        p.line(x + 3, y - 6, x + 7, y - 11, 1, "#6f625c"); // poker over the shoulder
        p.rect(x + 6, y - 12, 2, 1, "#ff6a2b");
      },
    },
    {
      id: "apprentice",
      at: apprenticeLoop[0]!,
      pos: apprenticePos,
      draw(p, f) {
        const here = apprenticePos(f);
        walker(p, here, APPRENTICE, f);
        const [x, y] = feet(here);
        p.rect(x + 3, y - 7, 1, 7, "#8a6a40"); // broom handle
        p.rect(x + 2, y, 3, 1, "#c9a24a");
      },
    },
    {
      id: "coal-hauler",
      at: haulerLoop[0]!,
      pos: haulerPos,
      draw(p, f) {
        const here = haulerPos(f);
        walker(p, here, HAULER, f);
        const [x, y] = feet(here);
        p.rect(x - 4, y - 10, 4, 4, "#1e1614"); // sack of coal on the back
        p.rect(x - 3, y - 11, 2, 1, "#2e2622");
      },
    },
    {
      id: "pacer",
      at: pacerLoop[0]!,
      pos: pacerPos,
      draw(p, f) {
        walker(p, pacerPos(f), PACER, f);
      },
    },
    {
      id: "sitter",
      at: sitterAt,
      draw(p, f) {
        // Sitting on a crate by a little brazier of their own.
        brazier(p, sitterAt[0] + 0.7, sitterAt[1] - 0.2, f, 4);
        const [x, y] = feet(sitterAt);
        p.rect(x - 3, y - 3, 6, 3, "#4a3a2e");
        drawPerson(p, x, y - 3, SITTER, f.motion && Math.sin(f.t * 0.9) > 0.8 ? 1 : 0, 0, false);
      },
    },
  ];
}
