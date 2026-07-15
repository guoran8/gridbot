import { describe, expect, it } from "vitest";
import { ema, rsi, sma, stddev } from "../src/indicators.js";
import { detectTrend, suggestBand, suggestMode } from "../src/trend.js";

describe("indicators", () => {
  it("sma averages the trailing window", () => {
    expect(sma([1, 2, 3, 4], 2)).toBe(3.5);
    expect(sma([1, 2], 5)).toBeNull();
  });

  it("ema weights recent values more", () => {
    const flat = ema([5, 5, 5, 5, 5], 3);
    expect(flat).toBeCloseTo(5);
  });

  it("rsi is 100 for a monotonic rise", () => {
    const up = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(up)).toBeCloseTo(100);
  });

  it("stddev of a constant series is 0", () => {
    expect(stddev([7, 7, 7, 7])).toBeCloseTo(0);
  });
});

describe("trend", () => {
  it("detects an uptrend and suggests long", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 * 1.01 ** i);
    const reading = detectTrend(closes);
    expect(reading.direction).toBe("up");
    expect(suggestMode(reading)).toBe("long");
  });

  it("detects a range and suggests neutral", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3));
    const reading = detectTrend(closes);
    expect(reading.direction).toBe("range");
    expect(suggestMode(reading)).toBe("neutral");
  });

  it("suggests a band bracketing the mark", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3));
    const band = suggestBand(closes, 100);
    expect(band.lowerPrice).toBeLessThan(100);
    expect(band.upperPrice).toBeGreaterThan(100);
  });
});
