import type { ExchangeId } from "@gridbot/shared";
import { PaperAdapter, type PaperAdapterOptions } from "./paper/paper-adapter.js";
import {
  DecibelAdapter,
  ExtendedAdapter,
  type LiveCredentials,
  RisexAdapter,
} from "./live/stubs.js";
import type { ExchangeAdapter } from "./types.js";

export type AdapterOptions =
  | { id: "paper"; paper: PaperAdapterOptions }
  | { id: "extended" | "decibel" | "risex"; credentials: LiveCredentials };

/** Construct the adapter for a venue. Paper needs sim options; live needs keys. */
export function createAdapter(opts: AdapterOptions): ExchangeAdapter {
  switch (opts.id) {
    case "paper":
      return new PaperAdapter(opts.paper);
    case "extended":
      return new ExtendedAdapter(opts.credentials);
    case "decibel":
      return new DecibelAdapter(opts.credentials);
    case "risex":
      return new RisexAdapter(opts.credentials);
  }
}

export function isLiveExchange(id: ExchangeId): id is "extended" | "decibel" | "risex" {
  return id !== "paper";
}
