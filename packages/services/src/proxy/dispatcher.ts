import { ProxyAgent, type Dispatcher, getGlobalDispatcher } from "undici";

/**
 * Build an undici dispatcher that routes all requests through an HTTP(S) proxy.
 * Pass this as `{ dispatcher }` to `fetch`/`request`, or install it globally.
 * Returns the current global dispatcher when no proxy URL is given.
 */
export function makeDispatcher(proxyUrl?: string): Dispatcher {
  if (!proxyUrl) return getGlobalDispatcher();
  return new ProxyAgent({ uri: proxyUrl });
}

/** A `fetch` bound to an optional proxy dispatcher — used by all outbound calls. */
export function makeProxiedFetch(proxyUrl?: string): typeof fetch {
  const dispatcher = proxyUrl ? new ProxyAgent({ uri: proxyUrl }) : undefined;
  if (!dispatcher) return fetch;
  return ((input: string | URL | Request, init?: RequestInit) =>
    // undici accepts a `dispatcher` option the DOM lib's RequestInit omits;
    // cast through unknown to bridge the two type worlds.
    fetch(input, { ...init, dispatcher } as unknown as RequestInit)) as typeof fetch;
}
