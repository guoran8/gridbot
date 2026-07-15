import { z } from "zod";
import { GridConfigSchema } from "./grid.js";
import { BotSnapshotSchema } from "./state.js";

/** POST /v1/bots — create a bot instance from a grid config. */
export const CreateBotRequestSchema = GridConfigSchema;
export type CreateBotRequest = z.infer<typeof CreateBotRequestSchema>;

/** Control actions for POST /v1/bots/:id/:action. */
export const BotActionSchema = z.enum(["start", "pause", "resume", "stop", "flatten", "recover"]);
export type BotAction = z.infer<typeof BotActionSchema>;

/** Body for POST /v1/bots/:id/adjust — live range re-band. */
export const AdjustRangeSchema = z.object({
  lowerPrice: z.number().finite().positive(),
  upperPrice: z.number().finite().positive(),
  gridCount: z.number().int().min(2).max(500),
});
export type AdjustRangeRequest = z.infer<typeof AdjustRangeSchema>;

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
