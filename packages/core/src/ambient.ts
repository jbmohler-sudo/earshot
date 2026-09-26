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
