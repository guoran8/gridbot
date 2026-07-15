import { z } from "zod";
import { BotStatusSchema } from "./enums.js";
import { FillSchema, OrderSchema, PositionSchema } from "./order.js";
import { BotSnapshotSchema, LogEntrySchema, PnlSummarySchema } from "./state.js";

/**
 * Server-sent events streamed to the dashboard over `GET /v1/stream` (SSE).
 * Discriminated on `type`. The full-state `snapshot` is sent on connect and
 * on any structural change; the others are incremental deltas.
 */
export const StreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("snapshot"), bot: BotSnapshotSchema }),
  z.object({
    type: z.literal("status"),
    botId: z.string(),
    status: BotStatusSchema,
  }),
  z.object({ type: z.literal("order"), order: OrderSchema }),
  z.object({ type: z.literal("fill"), fill: FillSchema }),
  z.object({ type: z.literal("position"), botId: z.string(), position: PositionSchema.nullable() }),
  z.object({ type: z.literal("pnl"), botId: z.string(), pnl: PnlSummarySchema }),
  z.object({ type: z.literal("log"), entry: LogEntrySchema }),
  z.object({ type: z.literal("markPrice"), botId: z.string(), markPrice: z.number().finite() }),
]);
export type StreamEvent = z.infer<typeof StreamEventSchema>;

export type StreamEventType = StreamEvent["type"];
