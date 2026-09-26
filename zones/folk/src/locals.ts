// The Hollow's locals: people who live here. Scenery, not listeners: muted clothes, no names,
// never counted. Placed behind venue stages or well clear of their crowds.
import { box, drawPerson, type Frame, type Look, type TilePoint, type ZoneLocal } from "@earshot/core";
import { iso } from "./scenery.ts";

const look = (skin: string, hair: string, shirt: string, pants: string, long = false): Look => ({ skin, hair, long, shirt, print: shirt, pants });
const FISHER = look("#b08a70", "#5a4a3e", "#4e5a48", "#3a3428");
const STOKER = look("#9a7058", "#2a2220", "#5a4a3a", "#34302a", true);
const CHOPPER = look("#c0a088", "#6a4a2e", "#6a4a3e", "#34302a");
const LIGHTER = look("#8a6450", "#1e1a18", "#48503e", "#2e2c26");
const BIRDER = look("#b89880", "#8a8070", "#5a5a48", "#34302a");

const at = (x: number, y: number): TilePoint => [x, y];
function feet([x, y]: TilePoint): [number, number] {
  const [cx, cy] = iso(x, y);
  return [Math.round(cx), Math.round(cy)];
}

export function createLocals(): ZoneLocal[] {
  const fisherAt = at(15, 3.6);
  const stokerAt = at(3.35, 11.6);
  const chopAt = at(5.9, 5.4);
  const lighterAt = at(18.2, 4.0);
  const birderAt = at(1.4, 29.8);

  return [
    {
      id: "fisherman",
      at: fisherAt,
      draw(p, f) {
        const [x, y] = feet(fisherAt);
        drawPerson(p, x, y, FISHER, 0, 0, false);
        // Rod out over the creek, line bobbing.
        const bob = f.motion ? Math.round(Math.sin(f.t * 1.4)) : 0;
        p.line(x + 3, y - 7, x + 10, y - 14, 1, "#8a6a40");
        p.line(x + 10, y - 14, x + 11, y - 6 + bob, 1, "#c9c4b8", 0.6);
        p.rect(x + 10, y - 6 + bob, 2, 1, "#e8e4d0");
      },
    },
    {
      id: "campfire-stoker",
      at: stokerAt,
      draw(p, f) {
        const [x, y] = feet(stokerAt);
        const stir = f.motion ? Math.sin(f.t * 1.1) : 0;
        drawPerson(p, x, y + 1, STOKER, stir > 0.3 ? 1 : 0, 0, false); // crouched a little
        p.line(x + 3, y - 4, x + 8, y - 1 + Math.round(stir), 1, "#4a3420");
      },
    },
    {
      id: "woodchopper",
      at: chopAt,
      draw(p, f) {
        box(p, iso, chopAt[0] + 0.3, chopAt[1] - 0.25, 0.4, 0.4, 3, "#8a6a40", "#6e4e30", "#5a4028"); // chopping block
        const [x, y] = feet(chopAt);
        const up = f.motion ? Math.sin(f.t * 2.2) > 0 : true;
        drawPerson(p, x, y, CHOPPER, 0, 0, up);
        if (up) p.rect(x + 3, y - 14, 3, 2, "#8a8490");
        else p.rect(x + 5, y - 5, 3, 2, "#8a8490");
      },
    },
    {
      id: "lantern-lighter",
      at: lighterAt,
      draw(p, f) {
        const [x, y] = feet(lighterAt);
        drawPerson(p, x, y, LIGHTER, 0, 0, false);
        p.line(x - 3, y - 7, x - 6, y - 17, 1, "#4a3420"); // lighting pole
        const flick = f.motion ? 0.6 + 0.4 * Math.sin(f.t * 9) : 1;
        p.rect(x - 7, y - 18, 2, 2, "#ffd06a", flick);
      },
    },
    {
      id: "birdwatcher",
      at: birderAt,
      draw(p, f) {
        const [x, y] = feet(birderAt);
        drawPerson(p, x, y, BIRDER, 0, 0, false);
        const look = f.motion && Math.sin(f.t * 0.4) > 0;
        p.rect(x + (look ? 1 : -2), y - 10, 3, 1, "#2a2220"); // binoculars, turning to scan
      },
    },
  ];
}
