import { describe, expect, it } from "vitest";
import { priceToTicks, sizeToSteps } from "../src/live/risex/client.js";

describe("risex scaling", () => {
  it("converts price to nearest tick", () => {
    // step_price 0.5 → 100.4 rounds to 201 ticks (100.5), 100.2 → 200 (100.0)
    expect(priceToTicks(100.5, 0.5)).toBe(201);
    expect(priceToTicks(100.2, 0.5)).toBe(200);
  });

  it("floors size to whole steps (never over-orders)", () => {
    // step_size 0.001 → 1.2349 floors to 1234 steps
    expect(sizeToSteps(1.2349, 0.001)).toBe(1234);
    expect(sizeToSteps(0.0009, 0.001)).toBe(0);
  });
});
