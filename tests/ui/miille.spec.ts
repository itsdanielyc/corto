import { join } from "node:path";
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

test("New film starts at once, and the film you were editing stays in Films", async ({
  page,
}) => {
  await openExampleFilm(page);
  await page.getByRole("button", { name: "Project actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "New film", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("scene-card")).toHaveCount(0);
  await expect(page.getByLabel("Project name")).toHaveValue("Untitled film");
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Mountain days", exact: true }),
  ).toBeVisible();
  // An untouched film is not worth keeping: starting another leaves no empty entry.
  await page.getByRole("button", { name: "New film", exact: true }).click();
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Untitled film", exact: true }),
  ).toHaveCount(0);
});

test("a slideshow started from Films chooses its own photos and becomes a film", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Try an example" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await page.getByRole("button", { name: "Slideshow", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Make a slideshow" });
  // With nothing imported yet the only way forward is to choose photos.
  await expect(dialog.getByRole("button", { name: "Next" })).toBeDisabled();
  await dialog
    .locator('input[type="file"]')
    .setInputFiles([
      join(process.cwd(), "tests/fixtures/red.png"),
      join(process.cwd(), "tests/fixtures/blue.png"),
    ]);
  await expect(dialog.getByText("2 of 2 chosen")).toBeVisible();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog
    .getByRole("button", { name: "Create editable draft", exact: true })
    .click();
  await expect(page.getByTestId("scene-card")).not.toHaveCount(0);
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
});

test("a removed scene comes back from the toast, and only until something else changes", async ({
  page,
}) => {
  await openExampleFilm(page);
  const cards = page.getByTestId("scene-card");
  await cards.nth(1).click();
  await page.getByRole("button", { name: "Delete scene", exact: true }).click();
  await expect(cards).toHaveCount(3);
  const toast = page.getByRole("status").filter({ hasText: "Scene removed" });
  await toast.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(cards).toHaveCount(4);
  await expect(toast).toHaveCount(0);
  // A later edit retires the offer, so Undo there can never reverse it.
  await cards.nth(1).click();
  await page.getByRole("button", { name: "Delete scene", exact: true }).click();
  await expect(toast).toBeVisible();
  const name = page.getByLabel("Project name");
  await name.fill("Mountain days, shorter");
  await name.press("Tab");
  await expect(toast).toHaveCount(0);
  await expect(cards).toHaveCount(3);
});
