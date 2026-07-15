import { describe, expect, it } from "vitest";
import {
  computeDomainHash,
  computeOrderHash,
  scaleAmounts,
  signOrder,
} from "../src/live/extended/sign.js";
import type { ExtendedL2Config, ExtendedStarknetInfo } from "../src/live/extended/client.js";

// NOTE: these assert *structure and determinism only*. They deliberately do NOT
// assert exact signature/hash byte values against a fabricated fixture — the
// scheme is unverified against a live Extended testnet fill, and inventing a
// "known good" signature would violate the fixture-realism rule (a wrong value
// would mutually reinforce a wrong implementation). Replace with a captured
// testnet vector once one is available.

const l2: ExtendedL2Config = {
  collateralId: "0x1",
  collateralResolution: 1_000_000,
  syntheticId: "0x2",
  syntheticResolution: 1_000_000_000,
};

const info: ExtendedStarknetInfo = {
  name: "Extended",
  version: "1",
  chainId: "SN_SEPOLIA",
  revision: "1",
};

// A throwaway in-range Stark test key (not tied to any funded account).
const TEST_KEY = "0x123456789abcdef123456789abcdef123456789abcdef";

describe("scaleAmounts", () => {
  it("mirrors sign convention across buy/sell", () => {
    const buy = scaleAmounts("buy", 1, 100, 0.0005, l2);
    const sell = scaleAmounts("sell", 1, 100, 0.0005, l2);
    expect(buy.baseAmount).toBeGreaterThan(0n);
    expect(buy.quoteAmount).toBeLessThan(0n);
    expect(sell.baseAmount).toBeLessThan(0n);
    expect(sell.quoteAmount).toBeGreaterThan(0n);
  });

  it("scales by the market resolutions", () => {
    const { baseAmount, quoteAmount } = scaleAmounts("buy", 2, 50, 0, l2);
    expect(baseAmount).toBe(2n * 1_000_000_000n); // qty * syntheticResolution
    expect(quoteAmount).toBe(-(100n * 1_000_000n)); // qty*price * collateralResolution
  });

  it("rounds fee up", () => {
    const { feeAmount } = scaleAmounts("buy", 1, 100, 0.0005, l2);
    // 0.0005 * 100 * 1_000_000 = 50000
    expect(feeAmount).toBe(50_000n);
  });
});

describe("order + domain hashing", () => {
  const orderInput = {
    positionId: "1000",
    amounts: scaleAmounts("buy", 1, 100, 0.0005, l2),
    l2,
    expirationSeconds: 1_800_000_000,
    salt: 42n,
  };

  it("is deterministic for identical inputs", () => {
    expect(computeOrderHash(orderInput)).toBe(computeOrderHash(orderInput));
    expect(computeDomainHash(info)).toBe(computeDomainHash(info));
  });

  it("changes when a field changes", () => {
    const a = computeOrderHash(orderInput);
    const b = computeOrderHash({ ...orderInput, salt: 43n });
    expect(a).not.toBe(b);
  });
});

describe("signOrder", () => {
  it("produces a stark key + r/s signature deterministically", () => {
    const orderInput = {
      positionId: "1000",
      amounts: scaleAmounts("buy", 1, 100, 0.0005, l2),
      l2,
      expirationSeconds: 1_800_000_000,
      salt: 7n,
    };
    const a = signOrder(TEST_KEY, info, orderInput);
    const b = signOrder(TEST_KEY, info, orderInput);
    expect(a.orderIdHex).toBe(b.orderIdHex);
    expect(a.signature.r).toBe(b.signature.r);
    expect(a.starkKey).toMatch(/^0x[0-9a-f]+$/);
  });
});
