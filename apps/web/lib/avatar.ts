// Avatar: three palette picks plus hair length. Stored as profiles.avatar (jsonb).
// Palettes come from the Phase 0 prototype. Drawing is core's drawPerson.
import type { Look } from "@earshot/core";

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
