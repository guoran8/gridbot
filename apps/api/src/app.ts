import {
  AiAdvisor,
  makeProxiedFetch,
  NotifierRegistry,
  TelegramNotifier,
  WebhookNotifier,
} from "@gridbot/services";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppConfig } from "./config.js";
import { BotManager } from "./bot/manager.js";
import { createDb } from "./db/client.js";
import { DrizzleBotStore } from "./db/store.js";
import type { BotStore } from "./db/store.js";
import { EventBus } from "./events/bus.js";
import { createLogger, type Logger } from "./logger.js";
import { aiRoutes } from "./routes/ai.js";
import { botsRoutes } from "./routes/bots.js";
import { streamRoutes } from "./routes/stream.js";
import { systemRoutes } from "./routes/system.js";

export interface AppContainer {
  config: AppConfig;
  logger: Logger;
  store: BotStore;
  bus: EventBus;
  manager: BotManager;
  notifiers: NotifierRegistry;
  advisor?: AiAdvisor;
  /** Close underlying resources (sqlite handle). */
  close: () => void;
}

/** Assemble the full application container from config. */
export function createContainer(config: AppConfig): AppContainer {
  const logger = createLogger(config.logLevel);
  const { db, sqlite } = createDb(config.dbPath);
  const store = new DrizzleBotStore(db);
  const bus = new EventBus();

  // All outbound HTTP (notifiers + AI) routes through the optional proxy.
  const proxiedFetch = makeProxiedFetch(config.proxyUrl);

  const notifiers = new NotifierRegistry((name, err) =>
    logger.warn({ err, notifier: name }, "notifier failed"),
  );
  if (config.telegram) {
    notifiers.add(
      new TelegramNotifier({
        botToken: config.telegram.botToken.reveal(),
        chatId: config.telegram.chatId,
        fetchImpl: proxiedFetch,
      }),
    );
  }
  if (config.webhookUrl) {
    notifiers.add(new WebhookNotifier({ url: config.webhookUrl, fetchImpl: proxiedFetch }));
  }

  const advisor = config.ai
    ? new AiAdvisor({
        provider: config.ai.provider,
        apiKey: config.ai.apiKey.reveal(),
        model: config.ai.model,
        fetchImpl: proxiedFetch,
      })
    : undefined;

  const manager = new BotManager(config, store, bus, logger, notifiers);
  return { config, logger, store, bus, manager, notifiers, advisor, close: () => sqlite.close() };
}

/** Build the Hono app over a container. */
export function createApp(c: AppContainer): Hono {
  const app = new Hono();
  app.use("*", cors({ origin: c.config.corsOrigin, credentials: true }));

  app.route("/", systemRoutes(c));
  app.route("/v1/bots", botsRoutes(c));
  app.route("/v1/stream", streamRoutes(c));
  app.route("/v1/ai", aiRoutes(c));

  app.onError((err, ctx) => {
    c.logger.error({ err }, "unhandled route error");
    return ctx.json({ error: { code: "internal", message: err.message } }, 500);
  });

  return app;
}
