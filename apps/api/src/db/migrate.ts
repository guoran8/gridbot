import { config as loadEnv } from "@dotenvx/dotenvx";

loadEnv({ path: [".env.local", ".env"], ignore: ["MISSING_ENV_FILE"], quiet: true });

import { loadConfig } from "../config.js";
import { createDb } from "./client.js";

// createDb runs the idempotent schema bootstrap; this just applies it and exits.
const config = loadConfig();
const { sqlite } = createDb(config.dbPath);
sqlite.close();
console.log(`schema ready at ${config.dbPath}`);
