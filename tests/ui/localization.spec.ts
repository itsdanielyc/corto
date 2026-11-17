import { test, expect } from "@playwright/test";
import { join } from "node:path";
test("Spanish settings persist while personal project names and captions remain unchanged", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("media-input")
    .setInputFiles(join(process.cwd(), "tests/fixtures/red.png"));
  await expect(page.getByTestId("scene-card")).toHaveCount(1);
  await page.getByLabel("Project name").fill("Family album — original name");
  await page.getByLabel("Project name").press("Tab");
  await page.getByLabel("On-screen title").fill("Keep these exact words");
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Settings & defaults", exact: true })
    .click();
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
