import { z } from "zod";
import { ExchangeIdSchema, OrderSideSchema, OrderStatusSchema } from "./enums.js";

const positive = z.number().finite().positive();
const nonneg = z.number().finite().nonnegative();

/** A limit order the bot placed for a specific grid rung. */
export const OrderSchema = z.object({
  /** Local id (uuid). Stable across the order's life. */
  id: z.string(),
  botId: z.string(),
  exchange: ExchangeIdSchema,
  symbol: z.string(),
  side: OrderSideSchema,
  price: positive,
  /** Base-asset quantity. */
  size: positive,
  status: OrderStatusSchema,
  /** Grid level this order belongs to. */
  gridIndex: z.number().int().nonnegative(),
  /** Client order id sent to the venue (idempotency key). */
  clientOrderId: z.string(),
  /** Venue-assigned id once acknowledged. */
  exchangeOrderId: z.string().optional(),
  filledSize: nonneg.default(0),
  createdAt: z.number().int(), // epoch ms
  updatedAt: z.number().int(),
});
export type Order = z.infer<typeof OrderSchema>;

/** A (partial) execution against an order. */
export const FillSchema = z.object({
  id: z.string(),
  botId: z.string(),
  orderId: z.string(),
  exchange: ExchangeIdSchema,
  symbol: z.string(),
  side: OrderSideSchema,
  price: positive,
  size: positive,
  /** Fee paid in quote currency (USD). Negative = rebate. */
  fee: z.number().finite(),
  gridIndex: z.number().int().nonnegative(),
  timestamp: z.number().int(),
});
export type Fill = z.infer<typeof FillSchema>;

/** Net position for a symbol on a venue. */
export const PositionSchema = z.object({
  exchange: ExchangeIdSchema,
  symbol: z.string(),
  /** Signed base quantity; positive = long, negative = short. */
  netQty: z.number().finite(),
  /** Volume-weighted average entry of the open position. */
  avgEntry: nonneg,
  markPrice: nonneg,
  unrealizedPnl: z.number().finite(),
  updatedAt: z.number().int(),
});
export type Position = z.infer<typeof PositionSchema>;
