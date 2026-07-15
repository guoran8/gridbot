import { createAdapter, type ExchangeAdapter } from "@gridbot/exchanges";
import type { LiveExchangeId } from "@gridbot/shared";
import type { AppConfig } from "../config.js";

/** Which live venues have enough config to construct an adapter. */
export function configuredVenues(config: AppConfig): LiveExchangeId[] {
  const out: LiveExchangeId[] = [];
  if (config.credentials.extended && config.extended) out.push("extended");
  if (config.credentials.decibel && config.decibel) out.push("decibel");
  if (config.credentials.risex && config.risex) out.push("risex");
  return out;
}

/**
 * Construct a live venue adapter from app config, independent of any bot.
 * Shared by the bot manager and the read-only venue endpoints.
 */
export function buildLiveAdapter(config: AppConfig, exchange: LiveExchangeId): ExchangeAdapter {
  const secret = config.credentials[exchange];
  if (!secret) {
    throw new Error(
      `no credentials for ${exchange} — set GRIDBOT_${exchange.toUpperCase()}_PRIVATE_KEY`,
    );
  }

  switch (exchange) {
    case "extended": {
      const ext = config.extended;
      if (!ext) {
        throw new Error(
          "extended needs GRIDBOT_EXTENDED_API_KEY + GRIDBOT_EXTENDED_VAULT_ID (plus the Stark key)",
        );
      }
      return createAdapter({
        id: "extended",
        credentials: { privateKey: secret.reveal(), apiKey: ext.apiKey.reveal() },
        extended: {
          vaultId: ext.vaultId,
          allowUnverifiedSigning: ext.allowUnverifiedSigning,
          network: "testnet",
        },
      });
    }
    case "decibel": {
      const dec = config.decibel;
      if (!dec) {
        throw new Error("decibel needs GRIDBOT_DECIBEL_SUBACCOUNT_ADDRESS (plus the Ed25519 key)");
      }
      return createAdapter({
        id: "decibel",
        credentials: { privateKey: secret.reveal() },
        decibel: {
          subaccountAddress: dec.subaccountAddress,
          nodeApiKey: dec.nodeApiKey,
          allowLive: dec.allowLive,
          network: "testnet",
        },
      });
    }
    case "risex": {
      const rise = config.risex;
      if (!rise) {
        throw new Error("risex needs GRIDBOT_RISEX_ACCOUNT_ADDRESS (plus the EVM signer key)");
      }
      return createAdapter({
        id: "risex",
        credentials: { privateKey: secret.reveal() },
        risex: {
          accountAddress: rise.accountAddress,
          collateralToken: rise.collateralToken,
          allowInsecureServerSigning: rise.allowInsecureServerSigning,
          network: "testnet",
        },
      });
    }
  }
}
