export type Tier = "busker" | "tavern" | "amph" | "fest";

/** busker 1, tavern 2–9, amph 10–49, fest 50+. */
export function tierOf(count: number): Tier {
  if (count >= 50) return "fest";
  if (count >= 10) return "amph";
  if (count >= 2) return "tavern";
  return "busker";
}
