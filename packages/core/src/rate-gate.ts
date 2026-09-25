/** Spaces calls so no more than `perSecond` start in any one-second window. */
export class RateGate {
  private next = 0;
  private readonly perSecond: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    perSecond: number,
    now: () => number = () => Date.now(),
    sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {
    this.perSecond = perSecond;
    this.now = now;
    this.sleep = sleep;
  }

  /** Resolves when the caller may start its request. */
  async wait(): Promise<void> {
    const t = this.now();
    const start = Math.max(t, this.next);
    this.next = start + 1000 / this.perSecond;
    if (start > t) await this.sleep(start - t);
  }

  /** Push the next slot out, e.g. after the remote side says slow down. */
  penalize(ms: number): void {
    this.next = Math.max(this.next, this.now()) + ms;
  }
}
