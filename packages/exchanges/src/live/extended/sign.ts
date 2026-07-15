import { ec, hash, num, shortString } from "starknet";
import type { ExtendedL2Config, ExtendedStarknetInfo } from "./client.js";

/**
 * ⚠️ UNVERIFIED SIGNING — DO NOT TRUST ON MAINNET WITHOUT TESTNET VALIDATION.
 *
 * This implements Extended's SNIP-12 / Poseidon order-signing scheme as
 * documented in the official example repo (github.com/x10xchange/examples,
 * `src/utils/signing/*` + `src/models/order.ts`) and API reference. It has NOT
 * been validated against a live testnet order round-trip or cross-checked
 * against the official x10 Python SDK's Rust signer.
 *
 * Two details are load-bearing and could not be confirmed from second-hand
 * sources — verify BOTH against a testnet fill before any live use:
 *   1. The buy/sell sign convention on base_amount / quote_amount.
 *   2. The exact felt encoding of signed (i64) amounts and asset ids.
 *
 * The SNIP-12 envelope (domain hash + "StarkNet Message" wrapper) follows the
 * published standard and is comparatively safe; the order struct is the risk.
 */

/** SNIP-12 type string for an Extended order (from the official example repo). */
const ORDER_TYPE_STRING =
  '"Order"("position_id":"felt","base_asset_id":"AssetId","base_amount":"i64",' +
  '"quote_asset_id":"AssetId","quote_amount":"i64","fee_asset_id":"AssetId",' +
  '"fee_amount":"u64","expiration":"Timestamp","salt":"felt")' +
  '"PositionId"("value":"u32")"AssetId"("value":"felt")"Timestamp"("seconds":"u64")';

const DOMAIN_TYPE_STRING =
  '"StarknetDomain"("name":"shortstring","version":"shortstring",' +
  '"chainId":"shortstring","revision":"shortstring")';

const STARKNET_P = 2n ** 251n + 17n * 2n ** 192n + 1n;

/** Encode a possibly-negative integer as a field element. */
function toFelt(value: bigint): string {
  const mod = ((value % STARKNET_P) + STARKNET_P) % STARKNET_P;
  return num.toHex(mod);
}

export interface ScaledAmounts {
  /** Signed synthetic (base) amount in StarkEx integer units. */
  baseAmount: bigint;
  /** Signed collateral (quote) amount in StarkEx integer units. */
  quoteAmount: bigint;
  /** Unsigned fee in collateral StarkEx units. */
  feeAmount: bigint;
}

/**
 * Scale decimal qty/price/fee into signed StarkEx integer amounts.
 * Rounding: BUY rounds up, SELL rounds down; fee always rounds up.
 */
export function scaleAmounts(
  side: "buy" | "sell",
  qty: number,
  price: number,
  feeRate: number,
  l2: ExtendedL2Config,
): ScaledAmounts {
  const collateral = qty * price;
  const roundSynthetic = side === "buy" ? Math.ceil : Math.floor;
  const syntheticStark = BigInt(roundSynthetic(qty * l2.syntheticResolution));
  const collateralStark = BigInt(
    side === "buy"
      ? Math.ceil(collateral * l2.collateralResolution)
      : Math.floor(collateral * l2.collateralResolution),
  );
  const feeStark = BigInt(Math.ceil(feeRate * collateral * l2.collateralResolution));

  // Convention (UNVERIFIED): buy receives synthetic (+base) and pays collateral
  // (−quote); sell is the mirror. Confirm against a testnet fill before live.
  const baseAmount = side === "buy" ? syntheticStark : -syntheticStark;
  const quoteAmount = side === "buy" ? -collateralStark : collateralStark;
  return { baseAmount, quoteAmount, feeAmount: feeStark };
}

export interface OrderHashInput {
  positionId: string | number;
  amounts: ScaledAmounts;
  l2: ExtendedL2Config;
  expirationSeconds: number;
  salt: bigint;
}

/** Poseidon hash of the order struct (pre domain-wrap). */
export function computeOrderHash(input: OrderHashInput): string {
  const orderSelector = hash.starknetKeccak(ORDER_TYPE_STRING);
  return hash.computePoseidonHashOnElements([
    orderSelector,
    num.toBigInt(input.positionId),
    input.l2.syntheticId,
    toFelt(input.amounts.baseAmount),
    input.l2.collateralId,
    toFelt(input.amounts.quoteAmount),
    input.l2.collateralId,
    toFelt(input.amounts.feeAmount),
    BigInt(input.expirationSeconds),
    toFelt(input.salt),
  ]);
}

/** SNIP-12 domain separator hash. */
export function computeDomainHash(info: ExtendedStarknetInfo): string {
  const typeHash = hash.starknetKeccak(DOMAIN_TYPE_STRING);
  return hash.computePoseidonHashOnElements([
    typeHash,
    shortString.encodeShortString(info.name),
    shortString.encodeShortString(info.version),
    shortString.encodeShortString(info.chainId),
    shortString.encodeShortString(info.revision ?? "1"),
  ]);
}

export interface SignedOrder {
  orderIdHex: string;
  starkKey: string;
  signature: { r: string; s: string };
}

/**
 * Produce the full SNIP-12 message hash and sign it with the Stark private key.
 * The returned `orderIdHex` is the order-struct hash (Extended uses it as the
 * order id, sent as a decimal string on the wire).
 */
export function signOrder(
  starkPrivateKey: string,
  info: ExtendedStarknetInfo,
  orderInput: OrderHashInput,
): SignedOrder {
  const orderHash = computeOrderHash(orderInput);
  const domainHash = computeDomainHash(info);
  const publicKey = ec.starkCurve.getStarkKey(starkPrivateKey);

  // SNIP-12 rev1 envelope: poseidon("StarkNet Message", domain, account, message).
  const messageHash = hash.computePoseidonHashOnElements([
    shortString.encodeShortString("StarkNet Message"),
    domainHash,
    publicKey,
    orderHash,
  ]);

  const sig = ec.starkCurve.sign(messageHash, starkPrivateKey);
  return {
    orderIdHex: num.toHex(orderHash),
    starkKey: num.toHex(publicKey),
    signature: { r: num.toHex(sig.r), s: num.toHex(sig.s) },
  };
}
