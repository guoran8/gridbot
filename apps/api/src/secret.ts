/**
 * Minimal secret wrapper (ported from Mercury's SecretString). Keeps key
 * material out of logs and JSON dumps; `.reveal()` is the only way to read it
 * and should be called only at the signing/cipher boundary.
 */
export class SecretString {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return "[secret]";
  }

  toJSON(): string {
    return "[secret]";
  }

  get [Symbol.toStringTag](): string {
    return "SecretString";
  }
}
