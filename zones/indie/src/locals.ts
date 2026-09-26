// The Lot's locals: people who live here, where the eye goes (warehouse door, plaza, behind venues).
// Not listeners: no chest print, no name tag, no ring; never counted. The first two stay longest.
import { box, drawPerson, type Frame, type Look, loopAt, type Painter, type TilePoint, type ZoneLocal } from "@earshot/core";
import { iso } from "./scenery.ts";

const look = (skin: string, hair: string, shirt: string, pants: string, long = false): Look => ({ skin, hair, long, shirt, print: shirt, pants });
const DIGGER = look("#e8b896", "#3a3038", "#6a5a8a", "#2c3a5a", true);
const SKATER = look("#b57a52", "#15100e", "#c96a3a", "#23283a");
const SMOKER = look("#8a5634", "#1e1a1e", "#4a4a5a", "#1c1c24");
const WALKER = look("#f1c7a5", "#c9b18a", "#3a6a5e", "#2e2a3a", true);
const SNAPPER = look("#d9a47c", "#5a3a1e", "#8a3a4a", "#2c2e36");
const TEXTER = look("#5e3a24", "#15100e", "#d9c46a", "#23283a");

const at = (x: number, y: number): TilePoint => [x, y];
const feet = ([x, y]: TilePoint): [number, number] => {
  const [cx, cy] = iso(x, y);
  return [Math.round(cx), Math.round(cy)];
};
function walker(p: Painter, where: TilePoint, l: Look, f: Frame): void {
  const [x, y] = feet(where);
  drawPerson(p, x, y, l, 0, f.motion ? (Math.sin(f.t * 9) > 0 ? 1 : -1) : 0, false);
}

export function createLocals(): ZoneLocal[] {
  const diggerAt = at(6.0, 6.9);
  const skateLine: TilePoint[] = [at(7.6, 5.4), at(12.2, 5.4)];
  const skaterPos = (f: Frame) => (f.motion ? loopAt(skateLine, 1.6, f.t) : skateLine[0]!);
  const smokerAt = at(2.6, 7.0);
  const walkLoop: TilePoint[] = [at(6.5, 9.6), at(6.5, 12.8), at(3.6, 13.9), at(3.0, 12.2)];
  const walkerPos = (f: Frame) => (f.motion ? loopAt(walkLoop, 0.5, f.t + 2) : walkLoop[0]!);
  const snapAt = at(18.6, 17.4);
  const textAt = at(6.8, 19.6);

  return [
    {
      id: "crate-digger",
      at: diggerAt,
      draw(p, f) {
        box(p, iso, diggerAt[0] - 0.9, diggerAt[1] - 0.35, 0.6, 0.45, 4, "#6a5238", "#7d6242", "#584430"); // record bin
        const [x, y] = feet(diggerAt);
        drawPerson(p, x, y, DIGGER, 0, 0, false);
        const [bx, by] = feet(at(diggerAt[0] - 0.6, diggerAt[1] - 0.15));
        const flip = f.motion ? Math.floor(f.t * 1.6) % 3 : 0;
        p.rect(bx - 1 + flip, by - 7, 1, 3, "#efe4d6"); // a sleeve being flipped
        p.rect(bx - 2, by - 6, 4, 1, "#ff5fa2", 0.8);
      },
    },
    {
      id: "skateboarder",
      at: skateLine[0]!,
      pos: skaterPos,
      draw(p, f) {
        const here = skaterPos(f);
        const [x, y] = feet(here);
        p.rect(x - 3, y, 7, 1, "#e0a030"); // deck
        p.rect(x - 3, y + 1, 1, 1, "#1a1920");
        p.rect(x + 3, y + 1, 1, 1, "#1a1920");
        drawPerson(p, x, y - 1, SKATER, 0, 0, f.motion && Math.sin(f.t * 1.1) > 0.75);
      },
    },
    {
      id: "smoker",
      at: smokerAt,
      draw(p, f) {
        const [x, y] = feet(smokerAt);
        drawPerson(p, x, y, SMOKER, 0, 0, false);
        p.rect(x + 3, y - 8, 1, 1, "#ff6a2b");
        if (f.motion) {
          const puff = (f.t * 0.7) % 1;
          p.rect(x + 3 + Math.round(puff * 2), y - 11 - Math.round(puff * 6), 2, 2, "#b8b4c0", 0.55 * (1 - puff));
        }
      },
    },
    {
      id: "dog-walker",
      at: walkLoop[0]!,
      pos: walkerPos,
      draw(p, f) {
        const here = walkerPos(f);
        walker(p, here, WALKER, f);
        const [x, y] = feet(here);
        const trot = f.motion && Math.sin(f.t * 10) > 0 ? 1 : 0;
        p.line(x + 3, y - 5, x + 7, y - 2, 1, "#c9c4b8", 0.7); // lead
        p.rect(x + 6, y - 3, 4, 2, "#e8e4d0"); // small dog
        p.rect(x + 9, y - 4, 2, 2, "#e8e4d0");
        p.rect(x + 6, y - 1, 1, 1 + trot, "#b8b4a8");
        p.rect(x + 9, y - 1, 1, 2 - trot, "#b8b4a8");
      },
    },
    {
      id: "photographer",
      at: snapAt,
      draw(p, f) {
        const [x, y] = feet(snapAt);
        drawPerson(p, x, y, SNAPPER, 0, 0, false);
        p.rect(x - 4, y - 10, 3, 2, "#1a1920"); // camera up to the eye
        if (f.motion && Math.sin(f.t * 0.8) > 0.97) p.rect(x - 6, y - 11, 2, 2, "#fff0c2"); // flash
      },
    },
    {
      id: "texter",
      at: textAt,
      draw(p, f) {
        const [x, y] = feet(textAt);
        drawPerson(p, x, y, TEXTER, f.motion && Math.sin(f.t * 0.7) > 0.9 ? 1 : 0, 0, false);
        const glow = f.motion ? 0.7 + 0.3 * Math.sin(f.t * 3) : 1;
        p.rect(x - 1, y - 7, 2, 2, "#8fd4e8", glow); // phone screen lighting the face
      },
    },
  ];
}
