import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/ui",
  testMatch: "export.spec.ts",
  grep: /webm fallback|slow decoder startup/,
  workers: 2,
  retries: 0,
  use: {
    baseURL: "http://localhost:1420",
    viewport: { width: 1024, height: 700 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "npx cross-env VITE_CORTO_MOCK=1 VITE_CORTO_EXPERIMENTAL_WEBM=1 npm run dev:web -- --strictPort --port 1420",
    url: "http://localhost:1420",
    reuseExistingServer: false,
  },
});
