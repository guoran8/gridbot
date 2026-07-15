import { z } from "zod";
import { GridConfigSchema } from "./grid.js";
import { BotSnapshotSchema } from "./state.js";

/** POST /v1/bots — create a bot instance from a grid config. */
export const CreateBotRequestSchema = GridConfigSchema;
export type CreateBotRequest = z.infer<typeof CreateBotRequestSchema>;

/** Control actions for POST /v1/bots/:id/:action. */
export const BotActionSchema = z.enum(["start", "pause", "resume", "stop", "flatten"]);
export type BotAction = z.infer<typeof BotActionSchema>;

export const BotListResponseSchema = z.object({
  bots: z.array(BotSnapshotSchema),
});
export type BotListResponse = z.infer<typeof BotListResponseSchema>;

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
