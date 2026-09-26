// The Lot's locals: people who live here. Scenery, not listeners: muted clothes, no names,
// never counted. Placed behind venue stages or well clear of their crowds.
import { box, drawPerson, type Frame, type Look, type Painter, type TilePoint, type ZoneLocal } from "@earshot/core";
import { iso } from "./scenery.ts";

const look = (skin: string, hair: string, shirt: string, pants: string, long = false): Look => ({ skin, hair, long, shirt, print: shirt, pants });
const DIGGER = look("#b89480", "#3a3038", "#4a4652", "#2e3040", true);
const SKATER = look("#a07a62", "#2a2228", "#565060", "#34343e");
const SMOKER = look("#8a6a58", "#1e1a1e", "#3e3a44", "#2a2a32");
const RAILER = look("#b08a70", "#4a3a2a", "#5a5448", "#303236");
const SNAPPER = look("#c0a08a", "#6a5a4a", "#4a5058", "#2c2e36", true);

const at = (x: number, y: number): TilePoint => [x, y];
function feet([x, y]: TilePoint): [number, number] {
  const [cx, cy] = iso(x, y);
  return [Math.round(cx), Math.round(cy)];
}

export function createLocals(): ZoneLocal[] {
  const diggerAt = at(7.1, 5.2);
  const smokerAt = at(5.7, 6.5);
  const railAt = at(24.2, 3.45);
  const snapAt = at(30.4, 21.5);
  const skaterPos = (f: Frame): TilePoint => (f.motion ? at(15.5 + 3.5 * Math.sin(f.t * 0.45), 3.75) : at(13, 3.75));

  return [
    {
      id: "crate-digger",
      at: diggerAt,
      draw(p, f) {
        // A sidewalk record bin, and someone flipping through it.
        box(p, iso, diggerAt[0] + 0.25, diggerAt[1] - 0.35, 0.6, 0.45, 4, "#6a5238", "#7d6242", "#584430");
        const [x, y] = feet(diggerAt);
        const flip = f.motion ? Math.floor(f.t * 1.6) % 3 : 0;
        drawPerson(p, x, y, DIGGER, 0, 0, false);
        const [bx, by] = feet(at(diggerAt[0] + 0.55, diggerAt[1] - 0.1));
        p.rect(bx - 2 + flip, by - 7, 1, 3, "#c9c4b8"); // the sleeve being flipped
      },
    },
    {
      id: "skateboarder",
      at: at(15.5, 3.75),
      pos: skaterPos,
      draw(p, f) {
        const here = skaterPos(f);
        const [x, y] = feet(here);
        const dir = f.motion && Math.cos(f.t * 0.45) < 0 ? -1 : 1;
        p.rect(x - 3, y, 7, 1, "#8a5a3a"); // deck
        p.rect(x - 3 + (dir > 0 ? 0 : 5), y + 1, 1, 1, "#1a1920");
        p.rect(x + 3 - (dir > 0 ? 0 : 5), y + 1, 1, 1, "#1a1920");
        drawPerson(p, x, y - 1, SKATER, f.motion && Math.sin(f.t * 3) > 0.7 ? 1 : 0, 0, f.motion && Math.sin(f.t * 0.9) > 0.8);
      },
    },
    {
      id: "smoker",
      at: smokerAt,
      draw(p, f) {
        const [x, y] = feet(smokerAt);
        drawPerson(p, x, y, SMOKER, 0, 0, false);
        if (f.motion) {
          const puff = (f.t * 0.7) % 1;
          p.rect(x + 3 + Math.round(puff * 2), y - 11 - Math.round(puff * 6), 2, 2, "#8a8490", 0.5 * (1 - puff));
        }
      },
    },
    {
      id: "rail-worker",
      at: railAt,
      draw(p, f) {
        const [x, y] = feet(railAt);
        const swing = f.motion ? Math.sin(f.t * 1.8) : 0;
        drawPerson(p, x, y, RAILER, swing > 0.5 ? 1 : 0, 0, false);
        p.line(x + 3, y - 5, x + 6, y - 2 + Math.round(swing), 1, "#8a8490"); // wrench
        p.rect(x - 1, y - 11, 3, 1, "#e0a030"); // hard hat brim
      },
    },
    {
      id: "photographer",
      at: snapAt,
      draw(p, f) {
        const [x, y] = feet(snapAt);
        drawPerson(p, x, y, SNAPPER, 0, 0, false);
        p.rect(x - 4, y - 9, 2, 2, "#1a1920"); // camera up to the eye
        if (f.motion && Math.sin(f.t * 0.5) > 0.985) p.rect(x - 6, y - 10, 2, 2, "#fff0c2"); // the occasional flash
      },
    },
  ];
}
