import { z } from "zod";
import { SecretString } from "./secret.js";

/** Raw env schema. All vars are prefixed GRIDBOT_. */
const EnvSchema = z.object({
  GRIDBOT_PORT: z.coerce.number().int().positive().default(8787),
  GRIDBOT_DB_PATH: z.string().default("./data/gridbot.sqlite"),
  /** Bot reconcile cadence in ms (0 disables the timer — manual/test mode). */
  GRIDBOT_RECONCILE_MS: z.coerce.number().int().nonnegative().default(1500),
  GRIDBOT_CORS_ORIGIN: z.string().default("http://localhost:3000"),
  GRIDBOT_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // --- Live exchange credentials (optional; consumed in Phase 6) ---
  GRIDBOT_EXTENDED_PRIVATE_KEY: z.string().optional(),
  GRIDBOT_DECIBEL_PRIVATE_KEY: z.string().optional(),
  GRIDBOT_RISEX_PRIVATE_KEY: z.string().optional(),

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
  reconcileMs: number;
  corsOrigin: string;
  logLevel: "debug" | "info" | "warn" | "error";
  credentials: {
    extended?: SecretString;
    decibel?: SecretString;
    risex?: SecretString;
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
