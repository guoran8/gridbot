import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // @decibeltrade/sdk ships extensionless relative imports in its dist (valid
    // for bundlers/tsx, but not Node's native ESM resolver that vitest uses).
    // Inlining routes it through esbuild, which resolves them.
    server: {
      deps: {
        inline: [/@decibeltrade\/sdk/, /@aptos-labs/],
      },
    },
  },
});
