import { pino } from "pino";

export type Logger = ReturnType<typeof pino>;

export function createLogger(level: string): Logger {
  return pino({
    level,
    transport:
      process.env.NODE_ENV === "production"
        ? undefined
        : { target: "pino/file", options: { destination: 1 } },
  });
}
