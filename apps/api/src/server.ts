import { config as loadEnv } from "@dotenvx/dotenvx";

// Load env before reading config. Missing files are fine (env may come from the
// process/container directly).
loadEnv({ path: [".env.local", ".env"], ignore: ["MISSING_ENV_FILE"], quiet: true });

import { serve } from "@hono/node-server";
import { createApp, createContainer } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const container = createContainer(config);
await container.manager.init();
container.scheduler?.start();

const app = createApp(container);
const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  container.logger.info(`gridbot api listening on http://localhost:${info.port}`);
});

async function shutdown(signal: string): Promise<void> {
  container.logger.info(`received ${signal}, shutting down`);
  server.close();
  await container.manager.shutdown();
  container.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
