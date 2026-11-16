import { defineConfig } from "@playwright/test";
import web from "./playwright.web.config";
export default defineConfig({ ...web, testDir: "tests/advisory" });
