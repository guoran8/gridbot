/**
 * Credentials for a live venue. Held opaquely; the real adapters reveal them
 * only at the signing boundary. All three venues (Extended/Decibel/RISEx) are
 * now implemented — see ./{extended,decibel,risex}/adapter.ts.
 */
export interface LiveCredentials {
  /** Extended: Stark private key. Decibel: Aptos Ed25519 key. RISEx: EVM signer key. */
  privateKey: string;
  /** Optional API/L2 credentials some venues require alongside the signer. */
  apiKey?: string;
  apiSecret?: string;
  /** Optional funding/account address override. */
  accountAddress?: string;
}
