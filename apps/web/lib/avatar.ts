// Avatar: three palette picks plus hair length. Stored as profiles.avatar (jsonb).
// Palettes come from the Phase 0 prototype.

export const SKINS = ["#f1c7a5", "#e8b896", "#d9a47c", "#b57a52", "#8a5634", "#5e3a24"] as const;
export const HAIRS = ["#15100e", "#2b1d15", "#5a3a1e", "#8b6a3e", "#c9b18a", "#7a1f1a", "#d4d0c8"] as const;
export const SHIRTS = ["#15100f", "#3b1a1a", "#1d2a3a", "#2e2e2e", "#4a3b2a", "#efe4d6", "#ff6a2b", "#2f4a2a"] as const;

export interface Avatar {
  skin: number;
  hair: number;
  shirt: number;
  long: boolean;
}

export const DEFAULT_AVATAR: Avatar = { skin: 1, hair: 1, shirt: 0, long: false };

const idx = (v: unknown, n: number, fallback: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < n ? v : fallback;

/** Coerce anything (stored jsonb, form input) into a valid Avatar. */
export function parseAvatar(raw: unknown): Avatar {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    skin: idx(o.skin, SKINS.length, DEFAULT_AVATAR.skin),
    hair: idx(o.hair, HAIRS.length, DEFAULT_AVATAR.hair),
    shirt: idx(o.shirt, SHIRTS.length, DEFAULT_AVATAR.shirt),
    long: typeof o.long === "boolean" ? o.long : DEFAULT_AVATAR.long,
  };
}

export interface Look {
  skin: string;
  hair: string;
  long: boolean;
  shirt: string;
  print: string;
  pants: string;
}

export function lookOf(a: Avatar): Look {
  return {
    skin: SKINS[a.skin]!,
    hair: HAIRS[a.hair]!,
    long: a.long,
    shirt: SHIRTS[a.shirt]!,
    print: a.shirt === 6 ? "#efe4d6" : "#ff6a2b",
    pants: "#1c2230",
  };
}

/** The prototype's pixel person, feet at (lx, ly). One unit = one art pixel. */
export function drawPerson(g: CanvasRenderingContext2D, lx: number, ly: number, p: Look, bob = 0, walk = 0, arms = false) {
  lx = Math.round(lx);
  ly = Math.round(ly);
  g.fillStyle = "rgba(0,0,0,0.4)";
  g.fillRect(lx - 2, ly, 5, 1);
  const l1 = walk ? (walk > 0 ? 1 : 0) : 0;
  const l2 = walk ? (walk > 0 ? 0 : 1) : 0;
  g.fillStyle = p.pants;
  g.fillRect(lx - 2, ly - 3 + l1, 2, 3 - l1);
  g.fillRect(lx + 1, ly - 3 + l2, 2, 3 - l2);
  const b = bob;
  g.fillStyle = p.shirt;
  g.fillRect(lx - 2, ly - 7 + b, 5, 4);
  g.fillStyle = p.print;
  g.fillRect(lx, ly - 6 + b, 1, 1);
  g.fillStyle = p.skin;
  if (arms) {
    g.fillRect(lx - 3, ly - 10 + b, 1, 3);
    g.fillRect(lx + 3, ly - 10 + b, 1, 3);
  } else {
    g.fillRect(lx - 3, ly - 6 + b, 1, 2);
    g.fillRect(lx + 3, ly - 6 + b, 1, 2);
  }
  const hb = b > 0 ? 1 : 0;
  g.fillRect(lx - 1, ly - 10 + b + hb, 3, 3);
  g.fillStyle = p.hair;
  g.fillRect(lx - 1, ly - 11 + b + hb, 3, 1);
  if (p.long) {
    g.fillRect(lx - 2, ly - 10 + b + hb, 1, 3 + hb);
    g.fillRect(lx + 2, ly - 10 + b + hb, 1, 3 + hb);
  }
}
