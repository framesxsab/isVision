import { defineConfig } from "vitest/config";

// vitest's default glob matches every *.test.* AND *.spec.* file in the
// project. The Playwright a11y suite under tests/ uses .spec.ts, which
// caused vitest to try to import it and crash on `test()` from a non-
// Playwright runner. Scope vitest to src/ (and the shared server-side
// helpers under functions/) so the two runners stay in their lanes.
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "functions/_shared/**/*.test.js"],
  },
});
