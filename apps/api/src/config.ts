import { z } from "zod";
import { SecretString } from "./secret.js";

/** Raw env schema. All vars are prefixed GRIDBOT_. */
const EnvSchema = z.object({
  GRIDBOT_PORT: z.coerce.number().int().positive().default(8787),
  GRIDBOT_DB_PATH: z.string().default("./data/gridbot.sqlite"),
  /** Bot reconcile cadence in ms (0 disables the timer — manual/test mode). */
  GRIDBOT_RECONCILE_MS: z.coerce.number().int().nonnegative().default(1500),
  /** Per-side fee rate assumed when validating grid economics (maker ~0.0002). */
  GRIDBOT_ASSUMED_FEE_RATE: z.coerce.number().finite().nonnegative().default(0.0002),
  GRIDBOT_CORS_ORIGIN: z.string().default("http://localhost:3000"),
  GRIDBOT_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // --- Live exchange credentials (optional) ---
  // Extended (Starknet): Stark key + API key + vault id all required for live.
  GRIDBOT_EXTENDED_PRIVATE_KEY: z.string().optional(),
  GRIDBOT_EXTENDED_API_KEY: z.string().optional(),
  GRIDBOT_EXTENDED_VAULT_ID: z.string().optional(),
  // Extended order signing is unverified — must be explicitly opted in.
  GRIDBOT_EXTENDED_ALLOW_UNVERIFIED_SIGNING: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  // Decibel (Aptos): API-wallet Ed25519 key + trading-account (subaccount) addr.
  GRIDBOT_DECIBEL_PRIVATE_KEY: z.string().optional(),
  GRIDBOT_DECIBEL_SUBACCOUNT_ADDRESS: z.string().optional(),
  GRIDBOT_DECIBEL_NODE_API_KEY: z.string().optional(),
  GRIDBOT_DECIBEL_ALLOW_LIVE: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  // RISEx (RISE Chain): EVM signer key + account address.
  GRIDBOT_RISEX_PRIVATE_KEY: z.string().optional(),
  GRIDBOT_RISEX_ACCOUNT_ADDRESS: z.string().optional(),
  GRIDBOT_RISEX_COLLATERAL_TOKEN: z.string().optional(),
  // Testnet-only: uses the API's server-side signing (sends key to the server).
  GRIDBOT_RISEX_ALLOW_INSECURE_SERVER_SIGNING: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),

  // --- AI advisor (optional) ---
  GRIDBOT_AI_PROVIDER: z.enum(["anthropic", "deepseek", "gemini"]).optional(),
  GRIDBOT_AI_API_KEY: z.string().optional(),
  GRIDBOT_AI_MODEL: z.string().optional(),

  // --- Notifications (optional) ---
  GRIDBOT_TELEGRAM_BOT_TOKEN: z.string().optional(),
  GRIDBOT_TELEGRAM_CHAT_ID: z.string().optional(),
  GRIDBOT_WEBHOOK_URL: z.string().url().optional(),

  // --- Outbound proxy for exchange/AI calls (optional) ---
  GRIDBOT_PROXY_URL: z.string().url().optional(),
});

export interface AppConfig {
  port: number;
  dbPath: string;
  assumedFeeRate: number;
  reconcileMs: number;
  corsOrigin: string;
  logLevel: "debug" | "info" | "warn" | "error";
  credentials: {
    extended?: SecretString;
    decibel?: SecretString;
    risex?: SecretString;
  };
  /** Extended-specific extras (Stark key lives in credentials.extended). */
  extended?: {
    apiKey: SecretString;
    vaultId: string;
    allowUnverifiedSigning: boolean;
  };
  /** Decibel-specific extras (Ed25519 key lives in credentials.decibel). */
  decibel?: {
    subaccountAddress: string;
    nodeApiKey?: string;
    allowLive: boolean;
  };
  /** RISEx-specific extras (EVM key lives in credentials.risex). */
  risex?: {
    accountAddress: string;
    collateralToken?: string;
    allowInsecureServerSigning: boolean;
  };
  ai?: {
    provider: "anthropic" | "deepseek" | "gemini";
    apiKey: SecretString;
    model?: string;
  };
  telegram?: { botToken: SecretString; chatId: string };
  webhookUrl?: string;
  proxyUrl?: string;
}

/** Parse + validate process env into a typed config, wrapping secrets. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Treat empty-string vars (common in `.env` templates) as unset, so optional
  // fields validate as `undefined` instead of failing e.g. `.url()` on "".
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string" && v.trim() !== "") cleaned[k] = v;
  }
  const parsed = EnvSchema.parse(cleaned);
  return {
    port: parsed.GRIDBOT_PORT,
    dbPath: parsed.GRIDBOT_DB_PATH,
    reconcileMs: parsed.GRIDBOT_RECONCILE_MS,
    assumedFeeRate: parsed.GRIDBOT_ASSUMED_FEE_RATE,
    corsOrigin: parsed.GRIDBOT_CORS_ORIGIN,
    logLevel: parsed.GRIDBOT_LOG_LEVEL,
    credentials: {
      extended: parsed.GRIDBOT_EXTENDED_PRIVATE_KEY
        ? new SecretString(parsed.GRIDBOT_EXTENDED_PRIVATE_KEY)
        : undefined,
      decibel: parsed.GRIDBOT_DECIBEL_PRIVATE_KEY
        ? new SecretString(parsed.GRIDBOT_DECIBEL_PRIVATE_KEY)
        : undefined,
      risex: parsed.GRIDBOT_RISEX_PRIVATE_KEY
        ? new SecretString(parsed.GRIDBOT_RISEX_PRIVATE_KEY)
        : undefined,
    },
    extended:
      parsed.GRIDBOT_EXTENDED_API_KEY && parsed.GRIDBOT_EXTENDED_VAULT_ID
        ? {
            apiKey: new SecretString(parsed.GRIDBOT_EXTENDED_API_KEY),
            vaultId: parsed.GRIDBOT_EXTENDED_VAULT_ID,
            allowUnverifiedSigning: parsed.GRIDBOT_EXTENDED_ALLOW_UNVERIFIED_SIGNING ?? false,
          }
        : undefined,
    decibel: parsed.GRIDBOT_DECIBEL_SUBACCOUNT_ADDRESS
      ? {
          subaccountAddress: parsed.GRIDBOT_DECIBEL_SUBACCOUNT_ADDRESS,
          nodeApiKey: parsed.GRIDBOT_DECIBEL_NODE_API_KEY,
          allowLive: parsed.GRIDBOT_DECIBEL_ALLOW_LIVE ?? false,
        }
      : undefined,
    risex: parsed.GRIDBOT_RISEX_ACCOUNT_ADDRESS
      ? {
          accountAddress: parsed.GRIDBOT_RISEX_ACCOUNT_ADDRESS,
          collateralToken: parsed.GRIDBOT_RISEX_COLLATERAL_TOKEN,
          allowInsecureServerSigning: parsed.GRIDBOT_RISEX_ALLOW_INSECURE_SERVER_SIGNING ?? false,
        }
      : undefined,
    ai:
      parsed.GRIDBOT_AI_PROVIDER && parsed.GRIDBOT_AI_API_KEY
        ? {
            provider: parsed.GRIDBOT_AI_PROVIDER,
            apiKey: new SecretString(parsed.GRIDBOT_AI_API_KEY),
            model: parsed.GRIDBOT_AI_MODEL,
          }
        : undefined,
    telegram:
      parsed.GRIDBOT_TELEGRAM_BOT_TOKEN && parsed.GRIDBOT_TELEGRAM_CHAT_ID
        ? {
            botToken: new SecretString(parsed.GRIDBOT_TELEGRAM_BOT_TOKEN),
            chatId: parsed.GRIDBOT_TELEGRAM_CHAT_ID,
          }
        : undefined,
    webhookUrl: parsed.GRIDBOT_WEBHOOK_URL,
    proxyUrl: parsed.GRIDBOT_PROXY_URL,
  };
}
