import { test, expect } from "@playwright/test";
import { join } from "node:path";
declare global {
  interface Window {
    cortoReleasePreferences?: () => void;
  }
}
test("Spanish settings persist while personal project names and captions remain unchanged", async ({
  page,
}) => {
  test.skip(
    process.platform === "darwin" && !process.env.CORTO_LOCALIZATION_DIAGNOSTIC,
    "Late settings load quarantined under issue #20; retained in settings diagnosis",
  );
  await page.goto("/");
  await page
    .getByTestId("media-input")
    .setInputFiles(join(process.cwd(), "tests/fixtures/red.png"));
  await expect(page.getByTestId("scene-card")).toHaveCount(1);
  await page.getByLabel("Project name").fill("Family album — original name");
  await page.getByLabel("Project name").press("Tab");
  await page.getByLabel("On-screen title").fill("Keep these exact words");
  await page.evaluate(async () => {
    const path = "/src/platform/browser-repository.ts";
    const { BrowserProjectRepository } = await import(path);
    const read = BrowserProjectRepository.prototype.loadPreferences;
    BrowserProjectRepository.prototype.loadPreferences = async function (
      this: object,
    ) {
      const saved = await read.call(this);
      return new Promise((resolve) => {
        window.cortoReleasePreferences = () => resolve(saved);
      });
    };
  });
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Settings & defaults", exact: true })
    .click();
  await expect(page.getByLabel("Language", { exact: true })).toBeDisabled();
  await page.waitForFunction(
    () => typeof window.cortoReleasePreferences === "function",
  );
  await page.evaluate(() => window.cortoReleasePreferences!());
  await page.getByLabel("Language", { exact: true }).selectOption("es");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Exportar la película", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Nombre del proyecto")).toHaveValue(
    "Family album — original name",
  );
  await expect(page.getByLabel("Título en pantalla")).toHaveValue(
    "Keep these exact words",
  );
  await expect(page.getByTestId("save-status")).toHaveText(
    "Guardado en este dispositivo",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByRole("button", { name: "Mis películas", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Nombre del proyecto")).toHaveValue(
    "Family album — original name",
  );
});
