// The Hollow's locals: people who live here, where the eye goes (campfire, cabin, plaza, behind venues,
// and one fisherman on the near bend of the creek). Not listeners: no chest print, no name tag, no ring;
// never counted. The first two stay longest.
import { box, drawPerson, type Frame, type Look, loopAt, type Painter, type TilePoint, type ZoneLocal } from "@earshot/core";
import { iso } from "./scenery.ts";

const look = (skin: string, hair: string, shirt: string, pants: string, long = false): Look => ({ skin, hair, long, shirt, print: shirt, pants });
const STOKER = look("#b57a52", "#2b1d15", "#8a4a2a", "#3a3428", true);
const CHOPPER = look("#e8b896", "#7a1f1a", "#8a2a2a", "#2e3040");
const LIGHTER = look("#8a5634", "#15100e", "#4e6a3a", "#2e2c26");
const FORAGER = look("#f1c7a5", "#c9b18a", "#7a6a3a", "#3a3428", true);
const BIRDER = look("#d9a47c", "#d4d0c8", "#3a5a6e", "#34302a");
const FISHER = look("#e8b896", "#5a3a1e", "#5a6a4a", "#2c3a5a");

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
  const stokerAt = at(4.8, 11.5);
  const chopAt = at(4.4, 6.9);
  const lighterLoop: TilePoint[] = [at(6.6, 9.0), at(6.6, 12.9)];
  const lighterPos = (f: Frame) => (f.motion ? loopAt(lighterLoop, 0.45, f.t) : lighterLoop[0]!);
  const forageLoop: TilePoint[] = [at(17.8, 18.4), at(19.2, 17.5), at(18.8, 19.0)];
  const foragerPos = (f: Frame) => (f.motion ? loopAt(forageLoop, 0.3, f.t + 1) : forageLoop[0]!);
  const birderAt = at(7.3, 18.3);
  const fisherAt = at(13.5, 3.7);

  return [
    {
      id: "campfire-stoker",
      at: stokerAt,
      draw(p, f) {
        const [x, y] = feet(stokerAt);
        const stir = f.motion ? Math.sin(f.t * 1.2) : 0;
        drawPerson(p, x, y + 1, STOKER, stir > 0.3 ? 1 : 0, 0, false); // crouched by the fire
        p.line(x - 3, y - 4, x - 8, y - 1 + Math.round(stir), 1, "#6a4a2a"); // stirring stick
        if (f.motion && stir > 0.8) p.rect(x - 9, y - 5, 1, 1, "#ffd06a");
      },
    },
    {
      id: "woodchopper",
      at: chopAt,
      draw(p, f) {
        box(p, iso, chopAt[0] + 0.35, chopAt[1] - 0.2, 0.4, 0.4, 3, "#8a6a40", "#6e4e30", "#5a4028"); // chopping block
        const [x, y] = feet(chopAt);
        const up = f.motion ? Math.sin(f.t * 2.2) > 0 : true;
        drawPerson(p, x, y, CHOPPER, 0, 0, up);
        if (up) p.rect(x + 3, y - 15, 3, 2, "#9a94a0");
        else {
          p.rect(x + 5, y - 5, 3, 2, "#9a94a0");
          if (f.motion) p.rect(x + 8, y - 7, 1, 1, "#c9a24a"); // a chip flies
        }
      },
    },
    {
      id: "lantern-lighter",
      at: lighterLoop[0]!,
      pos: lighterPos,
      draw(p, f) {
        const here = lighterPos(f);
        walker(p, here, LIGHTER, f);
        const [x, y] = feet(here);
        p.line(x + 3, y - 7, x + 6, y - 18, 1, "#6a4a2a"); // lighting pole
        const flick = f.motion ? 0.6 + 0.4 * Math.sin(f.t * 9) : 1;
        p.rect(x + 5, y - 19, 2, 2, "#ffd06a", flick);
      },
    },
    {
      id: "forager",
      at: forageLoop[0]!,
      pos: foragerPos,
      draw(p, f) {
        const here = foragerPos(f);
        walker(p, here, FORAGER, f);
        const [x, y] = feet(here);
        p.rect(x - 5, y - 6, 3, 3, "#8a6a40"); // basket
        p.rect(x - 4, y - 7, 1, 1, "#c93a3a"); // berries
      },
    },
    {
      id: "birdwatcher",
      at: birderAt,
      draw(p, f) {
        const [x, y] = feet(birderAt);
        drawPerson(p, x, y, BIRDER, 0, 0, false);
        const scan = f.motion && Math.sin(f.t * 0.4) > 0;
        p.rect(x + (scan ? 1 : -2), y - 10, 3, 1, "#2a2220"); // binoculars
      },
    },
    {
      id: "fisherman",
      at: fisherAt,
      draw(p, f) {
        const [x, y] = feet(fisherAt);
        drawPerson(p, x, y, FISHER, 0, 0, false);
        const bob = f.motion ? Math.round(Math.sin(f.t * 1.4)) : 0;
        p.line(x + 3, y - 7, x + 10, y - 15, 1, "#8a6a40"); // rod out over the creek
        p.line(x + 10, y - 15, x + 11, y - 7 + bob, 1, "#e8e4d0", 0.6);
        p.rect(x + 10, y - 7 + bob, 2, 1, "#c93a3a"); // float
      },
    },
  ];
}
