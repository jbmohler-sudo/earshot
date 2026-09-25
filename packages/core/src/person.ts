// The Phase 0 pixel person: 7×12 art pixels, feet at (lx, ly).
import type { Color, Painter } from "./painter.ts";

export interface Look {
  skin: Color;
  hair: Color;
  long: boolean;
  shirt: Color;
  print: Color;
  pants: Color;
}

/** bob: 0|1 (dancing), walk: −1|0|1 (leg frame), arms: raised. */
export function drawPerson(p: Painter, lx: number, ly: number, look: Look, bob = 0, walk = 0, arms = false): void {
  lx = Math.round(lx);
  ly = Math.round(ly);
  p.rect(lx - 2, ly, 5, 1, "#000000", 0.4);
  const l1 = walk ? (walk > 0 ? 1 : 0) : 0;
  const l2 = walk ? (walk > 0 ? 0 : 1) : 0;
  p.rect(lx - 2, ly - 3 + l1, 2, 3 - l1, look.pants);
  p.rect(lx + 1, ly - 3 + l2, 2, 3 - l2, look.pants);
  const b = bob;
  p.rect(lx - 2, ly - 7 + b, 5, 4, look.shirt);
  p.rect(lx, ly - 6 + b, 1, 1, look.print);
  if (arms) {
    p.rect(lx - 3, ly - 10 + b, 1, 3, look.skin);
    p.rect(lx + 3, ly - 10 + b, 1, 3, look.skin);
  } else {
    p.rect(lx - 3, ly - 6 + b, 1, 2, look.skin);
    p.rect(lx + 3, ly - 6 + b, 1, 2, look.skin);
  }
  const hb = b > 0 ? 1 : 0;
  p.rect(lx - 1, ly - 10 + b + hb, 3, 3, look.skin);
  p.rect(lx - 1, ly - 11 + b + hb, 3, 1, look.hair);
  if (look.long) {
    p.rect(lx - 2, ly - 10 + b + hb, 1, 3 + hb, look.hair);
    p.rect(lx + 2, ly - 10 + b + hb, 1, 3 + hb, look.hair);
  }
}
