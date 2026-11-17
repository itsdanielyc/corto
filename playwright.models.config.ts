import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "tests/models",
  timeout: 180000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "artifacts/model-tests",
});
