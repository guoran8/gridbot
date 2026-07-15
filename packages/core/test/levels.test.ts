import { describe, expect, it } from "vitest";
import { computeLevelPrices, initialSideForLevel, sizeForPrice } from "../src/levels.js";
import { makeConfig } from "./helpers.js";

describe("computeLevelPrices", () => {
  it("arithmetic spacing gives equal gaps with inclusive endpoints", () => {
    const prices = computeLevelPrices(makeConfig());
    expect(prices).toHaveLength(11);
    expect(prices[0]).toBe(100);
    expect(prices[10]).toBe(110);
    expect(prices[1]! - prices[0]!).toBeCloseTo(1);
    expect(prices[5]).toBeCloseTo(105);
  });

  it("geometric spacing gives equal percentage gaps", () => {
    const prices = computeLevelPrices(
      makeConfig({ lowerPrice: 100, upperPrice: 200, gridCount: 3, spacing: "geometric" }),
    );
    expect(prices[0]).toBe(100);
    expect(prices[1]).toBeCloseTo(141.421, 2);
    expect(prices[2]).toBe(200);
    // constant ratio
    expect(prices[1]! / prices[0]!).toBeCloseTo(prices[2]! / prices[1]!, 6);
  });
});

describe("initialSideForLevel", () => {
  it("neutral: buy below mark, sell above", () => {
    expect(initialSideForLevel(100, 105, "neutral")).toBe("buy");
    expect(initialSideForLevel(110, 105, "neutral")).toBe("sell");
  });
  it("long: buy below, empty above", () => {
    expect(initialSideForLevel(100, 105, "long")).toBe("buy");
    expect(initialSideForLevel(110, 105, "long")).toBe("none");
  });
  it("short: sell above, empty below", () => {
    expect(initialSideForLevel(110, 105, "short")).toBe("sell");
    expect(initialSideForLevel(100, 105, "short")).toBe("none");
  });
});

describe("sizeForPrice", () => {
  it("converts notional to base qty", () => {
    expect(sizeForPrice(100, 50)).toBe(2);
  });
});
