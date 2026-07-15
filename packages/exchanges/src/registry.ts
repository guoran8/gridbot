import type { ExchangeId } from "@gridbot/shared";
import { PaperAdapter, type PaperAdapterOptions } from "./paper/paper-adapter.js";
import { ExtendedAdapter } from "./live/extended/adapter.js";
import { DecibelAdapter, type LiveCredentials, RisexAdapter } from "./live/stubs.js";
import type { ExchangeAdapter } from "./types.js";

export interface ExtendedExtras {
  vaultId: string;
  allowUnverifiedSigning?: boolean;
  network?: "mainnet" | "testnet";
}

export type AdapterOptions =
  | { id: "paper"; paper: PaperAdapterOptions }
  | { id: "extended"; credentials: LiveCredentials; extended: ExtendedExtras }
  | { id: "decibel" | "risex"; credentials: LiveCredentials };

/** Construct the adapter for a venue. Paper needs sim options; live needs keys. */
export function createAdapter(opts: AdapterOptions): ExchangeAdapter {
  switch (opts.id) {
    case "paper":
      return new PaperAdapter(opts.paper);
    case "extended":
      // LiveCredentials → Extended: privateKey = Stark key, apiKey, vault from extras.
      return new ExtendedAdapter({
        starkPrivateKey: opts.credentials.privateKey,
        apiKey: opts.credentials.apiKey ?? "",
        vaultId: opts.extended.vaultId,
        network: opts.extended.network ?? "testnet",
        allowUnverifiedSigning: opts.extended.allowUnverifiedSigning ?? false,
      });
    case "decibel":
      return new DecibelAdapter(opts.credentials);
    case "risex":
      return new RisexAdapter(opts.credentials);
  }
}

export function isLiveExchange(id: ExchangeId): id is "extended" | "decibel" | "risex" {
  return id !== "paper";
}
