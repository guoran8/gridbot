import { type GridConfig, GridConfigSchema } from "@gridbot/shared";

/** Build a validated GridConfig with sane defaults for tests. */
export function makeConfig(overrides: Partial<Record<string, unknown>> = {}): GridConfig {
  return GridConfigSchema.parse({
    exchange: "paper",
    symbol: "BTC-USD",
    mode: "neutral",
    lowerPrice: 100,
    upperPrice: 110,
    gridCount: 11,
    perGridSizeUsd: 100,
    ...overrides,
  });
}
