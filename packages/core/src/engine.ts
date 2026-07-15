import type { GridConfig, GridLevel, OrderSide, PnlSummary } from "@gridbot/shared";
import { type AccountingState, applyFill, emptyAccounting, unrealizedPnl } from "./accounting.js";
import { computeLevelPrices, toGridLevels } from "./levels.js";
import {
  type DesiredOrder,
  desiredOrders,
  initialSlots,
  nextSlotsOnFill,
  type SlotSide,
} from "./slots.js";

export interface EngineFill {
  gridIndex: number;
  side: OrderSide;
  price: number;
  size: number;
  fee: number;
}

/** Serialisable engine state for crash recovery. */
export interface EngineState {
  slots: SlotSide[];
  accounting: AccountingState;
  initialized: boolean;
}

/**
 * The stateful grid engine. Pure decision logic lives in `slots`/`accounting`;
 * this class just holds the mutable runtime state and sequences the calls, so
 * the bot runner can stay a thin IO shell.
 */
export class GridEngine {
  readonly config: GridConfig;
  readonly prices: number[];
  private slots: SlotSide[];
  private accounting: AccountingState;
  private initialized = false;

  constructor(config: GridConfig, state?: EngineState) {
    this.config = config;
    this.prices = computeLevelPrices(config);
    if (state) {
      this.slots = state.slots.slice();
      this.accounting = state.accounting;
      this.initialized = state.initialized;
    } else {
      this.slots = this.prices.map(() => "none" as SlotSide);
      this.accounting = emptyAccounting();
    }
  }

  /** Seed the slot map from the first observed mark. Idempotent-safe: only runs once. */
  initialize(markPrice: number): void {
    if (this.initialized) return;
    this.slots = initialSlots(this.prices, markPrice, this.config.mode);
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /** Orders that should currently rest, given the mark. */
  desiredOrders(markPrice: number): DesiredOrder[] {
    return desiredOrders(this.slots, this.prices, this.config.perGridSizeUsd, markPrice);
  }

  /** Fold a fill into accounting and re-arm the counter rung. */
  recordFill(fill: EngineFill): void {
    this.accounting = applyFill(this.accounting, fill);
    this.slots = nextSlotsOnFill(this.slots, fill.gridIndex, fill.side);
  }

  /**
   * Fold a flatten/close fill into accounting only — no slot re-arming. Used
   * when the bot force-closes its position outside the grid ladder.
   */
  recordFlattenFill(fill: Omit<EngineFill, "gridIndex">): void {
    this.accounting = applyFill(this.accounting, fill);
  }

  levels(): GridLevel[] {
    return toGridLevels(this.prices, this.slots);
  }

  get position(): AccountingState["position"] {
    return this.accounting.position;
  }

  pnl(markPrice: number): PnlSummary {
    const unreal = unrealizedPnl(this.accounting.position, markPrice);
    return {
      realizedPnl: this.accounting.realizedPnl,
      unrealizedPnl: unreal,
      feesPaid: this.accounting.feesPaid,
      netPnl: this.accounting.realizedPnl - this.accounting.feesPaid + unreal,
      matchedTrades: this.accounting.matchedTrades,
      filledOrders: this.accounting.filledOrders,
      volumeUsd: this.accounting.volumeUsd,
    };
  }

  /** Snapshot the full engine state for persistence. */
  getState(): EngineState {
    return {
      slots: this.slots.slice(),
      accounting: this.accounting,
      initialized: this.initialized,
    };
  }
}
