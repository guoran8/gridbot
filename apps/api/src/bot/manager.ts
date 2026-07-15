import { randomUUID } from "node:crypto";
import { type EngineState, GridEngine } from "@gridbot/core";
import { createAdapter, type ExchangeAdapter } from "@gridbot/exchanges";
import {
  type BotAction,
  type BotSnapshot,
  type GridConfig,
  GridConfigSchema,
} from "@gridbot/shared";
import type { AppConfig } from "../config.js";
import type { BotStore } from "../db/store.js";
import type { EventBus } from "../events/bus.js";
import type { Logger } from "../logger.js";
import { BotRunner, type RunnerDeps } from "./runner.js";

/** Deterministic 32-bit seed from a bot id, so paper sims are reproducible per bot. */
function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Owns every bot runner. Creates them from config, wires the shared adapter/
 * engine, routes control actions, and rehydrates persisted bots on boot so a
 * crash/restart resumes cleanly.
 */
export class BotManager {
  private readonly runners = new Map<string, BotRunner>();
  private readonly deps: RunnerDeps;

  constructor(
    private readonly config: AppConfig,
    private readonly store: BotStore,
    private readonly bus: EventBus,
    private readonly logger: Logger,
  ) {
    this.deps = { store, bus, logger, reconcileMs: config.reconcileMs };
  }

  /** Rehydrate persisted bots. Bots that were running are resumed. */
  async init(): Promise<void> {
    for (const row of this.store.listBots()) {
      try {
        const cfg = GridConfigSchema.parse(JSON.parse(row.config));
        const engineState = row.engineState
          ? (JSON.parse(row.engineState) as EngineState)
          : undefined;
        const engine = new GridEngine(cfg, engineState);
        const runner = this.buildRunner(row.id, cfg, engine, "idle", row.startedAt);
        this.runners.set(row.id, runner);
        if (row.status === "running") {
          this.logger.info({ botId: row.id }, "resuming bot after restart");
          await runner.start();
        }
      } catch (err) {
        this.logger.error({ err, botId: row.id }, "failed to rehydrate bot");
      }
    }
  }

  createBot(input: GridConfig): BotSnapshot {
    const config = GridConfigSchema.parse(input);
    const id = randomUUID();
    const engine = new GridEngine(config);
    const now = Date.now();
    this.store.createBot({
      id,
      config: JSON.stringify(config),
      status: "idle",
      engineState: JSON.stringify(engine.getState()),
      lastError: null,
      startedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const runner = this.buildRunner(id, config, engine, "idle", null);
    this.runners.set(id, runner);
    this.logger.info({ botId: id, exchange: config.exchange }, "bot created");
    return runner.snapshot();
  }

  async control(id: string, action: BotAction): Promise<BotSnapshot> {
    const runner = this.require(id);
    switch (action) {
      case "start":
        await runner.start();
        break;
      case "pause":
        await runner.pause();
        break;
      case "resume":
        await runner.resume();
        break;
      case "stop":
        await runner.stop();
        break;
      case "flatten":
        await runner.flatten();
        break;
    }
    return runner.snapshot();
  }

  async deleteBot(id: string): Promise<void> {
    const runner = this.runners.get(id);
    if (runner) {
      await runner.stop().catch(() => {});
      runner.dispose();
      this.runners.delete(id);
    }
    this.store.deleteBot(id);
  }

  snapshots(): BotSnapshot[] {
    return [...this.runners.values()].map((r) => r.snapshot());
  }

  snapshot(id: string): BotSnapshot | undefined {
    return this.runners.get(id)?.snapshot();
  }

  has(id: string): boolean {
    return this.runners.has(id);
  }

  async shutdown(): Promise<void> {
    for (const runner of this.runners.values()) {
      runner.dispose();
    }
  }

  // --- internals -----------------------------------------------------------

  private buildRunner(
    id: string,
    config: GridConfig,
    engine: GridEngine,
    status: BotSnapshot["status"],
    startedAt: number | null,
  ): BotRunner {
    const adapter = this.buildAdapter(id, config);
    return new BotRunner({ id, config, adapter, engine, deps: this.deps, status, startedAt });
  }

  private buildAdapter(id: string, config: GridConfig): ExchangeAdapter {
    if (config.exchange === "paper") {
      const mid = (config.lowerPrice + config.upperPrice) / 2;
      return createAdapter({
        id: "paper",
        paper: {
          startPrice: mid,
          tickMs: 1000,
          seed: seedFromId(id),
          volatility: 0.003,
          startBalanceUsd: 100_000,
        },
      });
    }
    const secret = this.config.credentials[config.exchange];
    if (!secret) {
      throw new Error(
        `no credentials configured for ${config.exchange} — set GRIDBOT_${config.exchange.toUpperCase()}_PRIVATE_KEY`,
      );
    }
    return createAdapter({ id: config.exchange, credentials: { privateKey: secret.reveal() } });
  }

  private require(id: string): BotRunner {
    const runner = this.runners.get(id);
    if (!runner) throw new Error(`bot ${id} not found`);
    return runner;
  }
}
