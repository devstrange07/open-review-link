import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Flat config, native.
 *
 * `eslint-config-next@16` ships real flat configs, so `FlatCompat` is not used
 * here — it re-validated the legacy `configs` objects and crashed with
 * "Converting circular structure to JSON" before linting a single file.
 */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
      ".venv/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // `next/typescript` registers the typescript-eslint plugin, so these
      // rules resolve without importing it directly.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Node-side scripts and the test fixture print to stdout on purpose —
    // that output *is* their interface, so the app's browser console rule
    // does not apply to them.
    files: ["scripts/**/*.mjs", "tests/fixtures/**/*.mjs"],
    rules: { "no-console": "off" },
  },
];

export default eslintConfig;
