/**
 * Bounded random-walk price generator for the paper simulator.
 *
 * Geometric Brownian motion with a mild pull back toward `anchor`, so the mark
 * keeps oscillating through a grid band instead of wandering off — the point of
 * paper mode is to exercise the grid, not to model a real tape.
 */
export interface PriceSimOptions {
  start: number;
  /** Per-step volatility (stddev of log return), e.g. 0.002 = 0.2%. */
  volatility?: number;
  /** Mean-reversion strength toward the anchor, 0..1. */
  reversion?: number;
  /** Price the walk is pulled toward (defaults to `start`). */
  anchor?: number;
  /** Deterministic seed for reproducible sims/tests. */
  seed?: number;
}

/** Small deterministic PRNG (mulberry32) so paper runs are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class PriceSim {
  private price: number;
  private readonly anchor: number;
  private readonly volatility: number;
  private readonly reversion: number;
  private readonly rng: () => number;

  constructor(opts: PriceSimOptions) {
    this.price = opts.start;
    this.anchor = opts.anchor ?? opts.start;
    this.volatility = opts.volatility ?? 0.002;
    this.reversion = opts.reversion ?? 0.05;
    this.rng = mulberry32(opts.seed ?? 0x9e3779b9);
  }

  current(): number {
    return this.price;
  }

  /** Advance one step and return the new price. */
  step(): number {
    // Box–Muller for a standard normal from two uniforms.
    const u1 = Math.max(this.rng(), 1e-9);
    const u2 = this.rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    const shock = this.volatility * z;
    const pull = this.reversion * Math.log(this.anchor / this.price);
    this.price = this.price * Math.exp(pull + shock);
    return this.price;
  }
}
