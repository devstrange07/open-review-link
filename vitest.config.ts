import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Route modules read process.env at import time via getServerEnv(); tests
    // never touch those paths, but a clean env keeps failures legible.
    env: {
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // The `server-only` package throws by default so that importing a server
      // module from a Client Component fails the build. Under Vitest there is no
      // bundle to guard, and the stand-in Node runtime is the server, so point
      // the specifier at the package's own no-op `react-server` build. Without
      // this, any test that imports an adapter is unrunnable.
      "server-only": path.resolve(
        import.meta.dirname,
        "node_modules/server-only/empty.js",
      ),
    },
  },
});
