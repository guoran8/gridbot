import type { ExchangeId } from "@gridbot/shared";
import { PaperAdapter, type PaperAdapterOptions } from "./paper/paper-adapter.js";
import { ExtendedAdapter } from "./live/extended/adapter.js";
import { DecibelAdapter } from "./live/decibel/adapter.js";
import { RisexAdapter } from "./live/risex/adapter.js";
import type { LiveCredentials } from "./live/stubs.js";
import type { ExchangeAdapter } from "./types.js";

export interface ExtendedExtras {
  vaultId: string;
  allowUnverifiedSigning?: boolean;
  network?: "mainnet" | "testnet";
}

export interface DecibelExtras {
  subaccountAddress: string;
  nodeApiKey?: string;
  allowLive?: boolean;
  network?: "mainnet" | "testnet";
}

export interface RisexExtras {
  accountAddress: string;
  collateralToken?: string;
  allowInsecureServerSigning?: boolean;
  network?: "mainnet" | "testnet";
}

export type AdapterOptions =
  | { id: "paper"; paper: PaperAdapterOptions }
  | { id: "extended"; credentials: LiveCredentials; extended: ExtendedExtras }
  | { id: "decibel"; credentials: LiveCredentials; decibel: DecibelExtras }
  | { id: "risex"; credentials: LiveCredentials; risex: RisexExtras };

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
      return new DecibelAdapter({
        privateKey: opts.credentials.privateKey,
        subaccountAddress: opts.decibel.subaccountAddress,
        nodeApiKey: opts.decibel.nodeApiKey,
        network: opts.decibel.network ?? "testnet",
        allowLive: opts.decibel.allowLive ?? false,
      });
    case "risex":
      return new RisexAdapter({
        privateKey: opts.credentials.privateKey,
        accountAddress: opts.risex.accountAddress,
        collateralToken: opts.risex.collateralToken,
        network: opts.risex.network ?? "testnet",
        allowInsecureServerSigning: opts.risex.allowInsecureServerSigning ?? false,
      });
  }
}

export function isLiveExchange(id: ExchangeId): id is "extended" | "decibel" | "risex" {
  return id !== "paper";
}
