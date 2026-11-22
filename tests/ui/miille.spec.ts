import { expect, test } from "@playwright/test";
import { openExampleFilm } from "../helpers/browser-project";

// Behaviour Corto shares with the other miille apps (docs/design/miille.md).

test("an untouched new film claims nothing about saving, and the first edit is saved", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Try an example" }),
  ).toBeVisible();
  const status = page.getByTestId("save-status");
  await expect(status).toHaveAttribute("data-status", "blank");
  await expect(status).toHaveText("");
  const name = page.getByLabel("Project name");
  await name.fill("Summer at the lake");
  await name.press("Tab");
  await expect(status).toHaveText("Saved");
});

test("Settings opened from Films returns to Films, and from the editor returns to the film", async ({
  page,
}) => {
  await openExampleFilm(page);
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "General", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Films", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to my film" }).click();
  await page.keyboard.press("Control+Comma");
  await expect(
    page.getByRole("heading", { name: "General", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Project name")).toHaveValue("Mountain days");
});

test("a settings change is kept without a Save button", async ({ page }) => {
  await openExampleFilm(page);
  await page.keyboard.press("Control+Comma");
  await page.getByRole("button", { name: "New scenes", exact: true }).click();
  const length = page.getByLabel("Default photo duration", { exact: true });
  await length.fill("7");
  await length.press("Enter");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.keyboard.press("Control+Comma");
  await page.getByRole("button", { name: "New scenes", exact: true }).click();
  await expect(
    page.getByLabel("Default photo duration", { exact: true }),
  ).toHaveValue("7");
  await expect(page.getByRole("button", { name: /save settings/i })).toHaveCount(
    0,
  );
});
