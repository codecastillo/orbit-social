import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Editor-time nudge during the refined-dark migration; the blocking
    // gate is scripts/check-legacy-design.sh in CI. The bridge module and
    // its compat components import it legitimately until the cleanup pass.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/design/orbit.ts", "src/components/orbit/**"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@/lib/design/orbit",
              message:
                "Legacy bridge tokens. Migrated code styles with Tailwind classes on the globals.css tokens.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
