import { describe, expect, it } from "vitest";
import { RateGate } from "./rate-gate.ts";

function fakeClock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void (t += ms), advance: (ms: number) => void (t += ms) };
}

describe("RateGate", () => {
  it("spaces calls 1000/perSecond apart", async () => {
    const c = fakeClock();
    const gate = new RateGate(4, c.now, c.sleep);
    const starts: number[] = [];
    for (let i = 0; i < 9; i++) {
      await gate.wait();
      starts.push(c.now());
    }
    expect(starts).toEqual([0, 250, 500, 750, 1000, 1250, 1500, 1750, 2000]);
  });

  it("doesn't wait when calls are already slower than the limit", async () => {
    const c = fakeClock();
    const gate = new RateGate(4, c.now, c.sleep);
    await gate.wait();
    c.advance(1000);
    await gate.wait();
    expect(c.now()).toBe(1000);
  });

  it("penalize pushes the next slot out", async () => {
    const c = fakeClock();
    const gate = new RateGate(4, c.now, c.sleep);
    await gate.wait();
    gate.penalize(10_000);
    await gate.wait();
    expect(c.now()).toBe(10_250);
  });
});
