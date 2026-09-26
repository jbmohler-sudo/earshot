// The Outskirts' locals: people (and a dog) who live out here, where the eye goes (motel front, plaza,
// the pickup, behind venues). Not listeners: no chest print, no name tag, no ring; never counted.
// The first two stay longest.
import { box, drawPerson, type Frame, type Look, loopAt, type Painter, type TilePoint, type ZoneLocal } from "@earshot/core";
import { iso } from "./scenery.ts";

const look = (skin: string, hair: string, shirt: string, pants: string, long = false): Look => ({ skin, hair, long, shirt, print: shirt, pants });
const TRUCKER = look("#d9a47c", "#4a3a2a", "#3a5a8a", "#2e3040");
const SWEEPER = look("#8a5634", "#d4d0c8", "#8a6a4a", "#34343e", true);
const LEANER = look("#b57a52", "#15100e", "#c9a24a", "#23283a", true);
const GAZER = look("#f1c7a5", "#2b1d15", "#5a3a6e", "#2a2a32");
const HIKER = look("#e8b896", "#8b6a3e", "#4e7a6a", "#3a3428", true);

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
  const truckerAt = at(3.7, 6.5);
  const sweepLine: TilePoint[] = [at(1.8, 7.4), at(5.8, 7.4)];
  const sweeperPos = (f: Frame) => (f.motion ? loopAt(sweepLine, 0.35, f.t) : sweepLine[0]!);
  const dogLoop: TilePoint[] = [at(2.4, 9.6), at(4.9, 9.2), at(5.2, 11.8), at(2.8, 12.2)];
  const dogPos = (f: Frame) => (f.motion ? loopAt(dogLoop, 0.9, f.t + 4) : dogLoop[0]!);
  const leanerAt = at(15.9, 5.55);
  const gazerAt = at(18.6, 16.4);
  const hikerAt = at(11.8, 4.1);

  return [
    {
      id: "trucker",
      at: truckerAt,
      draw(p, f) {
        const [x, y] = feet(truckerAt);
        const sip = f.motion && Math.sin(f.t * 0.7) > 0.7;
        drawPerson(p, x, y, TRUCKER, 0, 0, false);
        p.rect(x - 1, y - 12, 3, 1, "#c93a3a"); // cap
        p.rect(x - 2, y - 12, 1, 1, "#c93a3a");
        p.rect(x + 3, y - (sip ? 9 : 6), 2, 2, "#efe4d6"); // coffee cup
      },
    },
    {
      id: "sweeper",
      at: sweepLine[0]!,
      pos: sweeperPos,
      draw(p, f) {
        const here = sweeperPos(f);
        walker(p, here, SWEEPER, f);
        const [x, y] = feet(here);
        p.rect(x + 3, y - 7, 1, 7, "#8a6a40"); // broom
        p.rect(x + 2, y, 3, 1, "#c9a24a");
        if (f.motion) p.rect(x + 5 + (Math.floor(f.t * 6) % 2), y - 1, 1, 1, "#a8946e", 0.6); // dust
      },
    },
    {
      id: "stray-dog",
      at: dogLoop[0]!,
      pos: dogPos,
      draw(p, f) {
        const [x, y] = feet(dogPos(f));
        const trot = f.motion && Math.sin(f.t * 10) > 0 ? 1 : 0;
        p.rect(x - 3, y - 4, 6, 2, "#a8784a"); // body
        p.rect(x + 2, y - 6, 2, 2, "#a8784a"); // head
        p.rect(x + 3, y - 7, 1, 1, "#6a4a3a"); // ear
        p.rect(x - 4, y - 5 - (f.motion && Math.sin(f.t * 6) > 0 ? 1 : 0), 1, 1, "#a8784a"); // wagging tail
        p.rect(x - 2, y - 2, 1, 2 - trot, "#7a5a3a");
        p.rect(x + 2, y - 2, 1, 1 + trot, "#7a5a3a");
      },
    },
    {
      id: "pickup-leaner",
      at: leanerAt,
      draw(p, f) {
        const [x, y] = feet(leanerAt);
        drawPerson(p, x, y, LEANER, f.motion && Math.sin(f.t * 0.5) > 0.9 ? 1 : 0, 0, false);
        p.rect(x - 4, y - 8, 1, 3, LEANER.skin); // elbow back on the truck bed
      },
    },
    {
      id: "stargazer",
      at: gazerAt,
      draw(p, f) {
        box(p, iso, gazerAt[0] - 0.2, gazerAt[1] - 0.2, 0.45, 0.4, 3, "#6a5846", "#7a6854", "#5a4a3a"); // a rock to sit on
        const [x, y] = feet(gazerAt);
        drawPerson(p, x, y - 3, GAZER, 0, 0, false);
        if (f.motion && Math.sin(f.t * 0.3) > 0.97) p.rect(x + 8, y - 30, 1, 1, "#fff0c2"); // shooting star
      },
    },
    {
      id: "hitchhiker",
      at: hikerAt,
      draw(p, f) {
        const [x, y] = feet(hikerAt);
        drawPerson(p, x, y, HIKER, 0, 0, false);
        box(p, iso, hikerAt[0] + 0.25, hikerAt[1] + 0.1, 0.3, 0.25, 3, "#6a5238", "#7d6242", "#584430"); // pack
        if (!f.motion || Math.sin(f.t * 0.6) > -0.3) p.rect(x - 5, y - 9, 2, 1, HIKER.skin); // thumb out
      },
    },
  ];
}
