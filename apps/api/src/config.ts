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
}

/** Parse + validate process env into a typed config, wrapping secrets. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
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
  };
}
