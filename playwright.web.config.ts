import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/web",
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run preview:web -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: false,
  },
});
