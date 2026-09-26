// The Outskirts' locals: people (and a dog) who live out here. Scenery, not listeners: muted clothes,
// no names, never counted. Placed behind venue stages or well clear of their crowds.
import { box, drawPerson, type Frame, type Look, type TilePoint, type ZoneLocal } from "@earshot/core";
import { iso } from "./scenery.ts";

const look = (skin: string, hair: string, shirt: string, pants: string, long = false): Look => ({ skin, hair, long, shirt, print: shirt, pants });
const TRUCKER = look("#b08a70", "#4a3a2a", "#5a4a48", "#2e3040");
const LEANER = look("#9a7058", "#2a2220", "#6a5a48", "#34343e", true);
const HIKER = look("#c0a088", "#6a5a4a", "#4e5a5a", "#3a3428", true);
const STARGAZER = look("#8a6450", "#1e1a18", "#3e3a44", "#2a2a32");

const at = (x: number, y: number): TilePoint => [x, y];
function feet([x, y]: TilePoint): [number, number] {
  const [cx, cy] = iso(x, y);
  return [Math.round(cx), Math.round(cy)];
}

export function createLocals(): ZoneLocal[] {
  const truckerAt = at(4.2, 6.2);
  const leanerAt = at(17.0, 4.5);
  const hikerAt = at(9, 3.5);
  const gazerAt = at(1.4, 29.8);
  const dogPos = (f: Frame): TilePoint => (f.motion ? at(24.2 + 0.9 * Math.sin(f.t * 0.5), 4.1 + 0.3 * Math.sin(f.t * 0.23)) : at(24.2, 4.1));

  return [
    {
      id: "trucker",
      at: truckerAt,
      draw(p, f) {
        const [x, y] = feet(truckerAt);
        const sip = f.motion && Math.sin(f.t * 0.7) > 0.8;
        drawPerson(p, x, y, TRUCKER, 0, 0, false);
        p.rect(x - 1, y - 12, 3, 1, "#8a3a2a"); // cap
        p.rect(x + 3, y - (sip ? 9 : 6), 2, 2, "#e0dbd0"); // coffee cup, up to the mouth now and then
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
      id: "hitchhiker",
      at: hikerAt,
      draw(p, f) {
        const [x, y] = feet(hikerAt);
        drawPerson(p, x, y, HIKER, 0, 0, false);
        box(p, iso, hikerAt[0] + 0.25, hikerAt[1] + 0.1, 0.3, 0.25, 3, "#6a5238", "#7d6242", "#584430"); // pack at their feet
        const thumb = !f.motion || Math.sin(f.t * 0.6) > -0.3;
        if (thumb) p.rect(x - 5, y - 9, 2, 1, HIKER.skin); // thumb out toward the road
      },
    },
    {
      id: "stray-dog",
      at: at(24.2, 4.1),
      pos: dogPos,
      draw(p, f) {
        const [x, y] = feet(dogPos(f));
        const trot = f.motion && Math.sin(f.t * 8) > 0 ? 1 : 0;
        p.rect(x - 3, y - 4, 6, 2, "#8a6a4a"); // body
        p.rect(x + 2, y - 6, 2, 2, "#8a6a4a"); // head
        p.rect(x - 4, y - 5 - (f.motion && Math.sin(f.t * 5) > 0 ? 1 : 0), 1, 1, "#8a6a4a"); // wagging tail
        p.rect(x - 2, y - 2, 1, 2 - trot, "#6a4a3a");
        p.rect(x + 2, y - 2, 1, 1 + trot, "#6a4a3a");
      },
    },
    {
      id: "stargazer",
      at: gazerAt,
      draw(p, f) {
        box(p, iso, gazerAt[0] - 0.2, gazerAt[1] - 0.2, 0.45, 0.4, 3, "#5a4a3a", "#6a5846", "#4a3c30"); // a rock to sit on
        const [x, y] = feet(gazerAt);
        drawPerson(p, x, y - 3, STARGAZER, 0, 0, false);
        if (f.motion && Math.sin(f.t * 0.3) > 0.97) p.rect(x + 8, y - 30, 1, 1, "#fff0c2"); // a shooting star, once in a while
      },
    },
  ];
}
