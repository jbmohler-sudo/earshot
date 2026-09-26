// How many ambient locals a zone shows. They keep an empty zone from feeling dead and step aside as
// real people arrive: about 6 with nobody around, 2 at 10 people, none at festival size (50).

export const AMBIENT_MAX = 6;
export const AMBIENT_AT_TEN = 2;
export const AMBIENT_GONE_AT = 50;

export function localsToShow(people: number, available: number): number {
  const n = Math.max(0, people);
  let k: number;
  if (n <= 10) k = Math.round(AMBIENT_MAX - ((AMBIENT_MAX - AMBIENT_AT_TEN) * n) / 10);
  else if (n < AMBIENT_GONE_AT) k = Math.round((AMBIENT_AT_TEN * (AMBIENT_GONE_AT - n)) / (AMBIENT_GONE_AT - 10));
  else k = 0;
  return Math.max(0, Math.min(available, k));
}

/** Position after `t` seconds walking a closed loop of tile points at `speed` tiles/s. */
export function loopAt(path: readonly (readonly [number, number])[], speed: number, t: number): [number, number] {
  if (path.length === 0) return [0, 0];
  if (path.length === 1) return [path[0]![0], path[0]![1]];
  const legs = path.map((a, i) => {
    const b = path[(i + 1) % path.length]!;
    return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  });
  const total = legs.reduce((s, l) => s + l.len, 0);
  if (total === 0) return [path[0]![0], path[0]![1]];
  let d = (((t * speed) % total) + total) % total;
  for (const l of legs) {
    if (d <= l.len) {
      const u = l.len === 0 ? 0 : d / l.len;
      return [l.a[0] + (l.b[0] - l.a[0]) * u, l.a[1] + (l.b[1] - l.a[1]) * u];
    }
    d -= l.len;
  }
  return [path[0]![0], path[0]![1]];
}
