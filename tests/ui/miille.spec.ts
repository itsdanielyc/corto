import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  openExampleFilm,
  savedBrowserProject,
} from "../helpers/browser-project";

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
  await expect(
    page.getByRole("button", { name: /save settings/i }),
  ).toHaveCount(0);
});

test("New film starts at once, and the film you were editing stays in Films", async ({
  page,
}) => {
  await openExampleFilm(page);
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
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
  await dialog.getByRole("checkbox", { name: /blue\.png/ }).uncheck();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog
    .getByRole("button", { name: "Create editable draft", exact: true })
    .click();
  await expect(page.getByTestId("scene-card")).not.toHaveCount(0);
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  const draft = await savedBrowserProject(page);
  expect(Object.values(draft.assets).map((asset) => asset.name)).toEqual([
    "red.png",
  ]);
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
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(name).toHaveValue("Mountain days");
  await expect(toast).toHaveCount(0);
});

// Regressions found in review of the family redesign.

test("Replace / relink still replaces after the file dialog takes focus from the menu", async ({
  page,
}) => {
  await openExampleFilm(page);
  const library = page.getByRole("complementary", { name: "Media library" });
  await library
    .getByRole("button", { name: /Lago di Braies/ })
    .first()
    .click({
      button: "right",
    });
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("menu", { name: "Media actions" })
    .getByRole("menuitem", { name: /Replace \/ relink/ })
    .click();
  // The native dialog takes focus away from the window, which blurs the menu.
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await (
    await chooser
  ).setFiles(join(process.cwd(), "tests/fixtures/blue.png"));
  await expect(page.getByTestId("scene-card").first()).toContainText("blue");
});

test("leaving a settings field unchanged, or changing a non-film setting, adds nothing to Undo", async ({
  page,
}) => {
  await openExampleFilm(page);
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await page.keyboard.press("Control+Comma");
  await page.getByRole("button", { name: "New scenes", exact: true }).click();
  const length = page.getByLabel("Default photo duration", { exact: true });
  await length.focus();
  await length.press("Tab");
  await page
    .getByRole("button", { name: "Updates and help", exact: true })
    .click();
  await page
    .getByLabel("Check for new releases when Corto opens", { exact: true })
    .click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
});

test("Escape keeps a number still being typed in Settings", async ({
  page,
}) => {
  await openExampleFilm(page);
  await page.keyboard.press("Control+Comma");
  await page.getByRole("button", { name: "New scenes", exact: true }).click();
  const length = page.getByLabel("Default photo duration", { exact: true });
  await length.fill("8");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Project name")).toBeVisible();
  await page.keyboard.press("Control+Comma");
  await page.getByRole("button", { name: "New scenes", exact: true }).click();
  await expect(
    page.getByLabel("Default photo duration", { exact: true }),
  ).toHaveValue("8");
});

test("Settings opened from Films by its shortcut returns to Films, and Escape on the title-bar menu stays in Settings", async ({
  page,
}) => {
  await openExampleFilm(page);
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Films", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+Comma");
  await expect(
    page.getByRole("heading", { name: "General", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "General", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Films", exact: true }),
  ).toBeVisible();
});

test("a second removal gets its own Undo toast time", async ({ page }) => {
  await openExampleFilm(page);
  const cards = page.getByTestId("scene-card");
  const toast = page.getByRole("status").filter({ hasText: "Scene removed" });
  await cards.nth(1).click();
  await page.getByRole("button", { name: "Delete scene", exact: true }).click();
  await expect(toast).toBeVisible();
  await page.waitForTimeout(4000);
  await cards.nth(1).click();
  await page.getByRole("button", { name: "Delete scene", exact: true }).click();
  await page.waitForTimeout(3000);
  await expect(toast).toBeVisible();
});

test("a film with only subtitles is kept in Films", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Try an example" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Timed subtitles", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add subtitle at playhead", exact: true })
    .click();
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Untitled film", exact: true }),
  ).toHaveCount(1);
});

for (const view of ["Films", "Settings"] as const)
  test(`${view} fits a phone without sideways scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openExampleFilm(page);
    await page.getByRole("button", { name: "My films", exact: true }).click();
    if (view === "Settings")
      await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: view === "Films" ? "Films" : "General",
        exact: true,
      }),
    ).toBeVisible();
    const sheet = (await page.locator(".home-sheet").boundingBox())!;
    expect(sheet.width).toBeGreaterThan(360);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  });

test("after the saved film fails to load, an edit says Not saved instead of Saving", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Try an example" }),
  ).toBeVisible();
  // A damaged current film: Corto refuses it and turns autosave off.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open("corto-local-v1");
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const transaction = opening.result.transaction(
            "projects",
            "readwrite",
          );
          transaction
            .objectStore("projects")
            .put({ schemaVersion: 99, broken: true }, "current");
          transaction.oncomplete = () => {
            opening.result.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
  );
  await page.reload();
  const status = page.getByTestId("save-status");
  await expect(status).toHaveAttribute("data-status", "error");
  await page.getByLabel("Project name").fill("Typed after the failure");
  await page.getByLabel("Project name").press("Tab");
  await page.waitForTimeout(1200);
  await expect(status).toHaveAttribute("data-status", "error");
  await expect(status).toHaveText("Not saved");
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Save a portable copy of these edits",
  );
  await expect(page.getByLabel("Project name")).toHaveValue(
    "Typed after the failure",
  );
  const download = page.waitForEvent("download");
  await page.keyboard.press("ControlOrMeta+s");
  expect((await download).suggestedFilename()).toContain(
    "Typed after the failure",
  );
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Films", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New film", exact: true }).click();
  const name = page.getByLabel("Project name");
  await name.fill("Separate holiday");
  await name.press("Tab");
  await expect(status).toHaveText("Saved");
  await page.reload();
  await expect(status).toHaveAttribute("data-status", "error");
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Separate holiday", exact: true }),
  ).toBeVisible();
});

test("a sound-only export does not offer picture sizes", async ({ page }) => {
  await openExampleFilm(page);
  await page.getByRole("button", { name: "Export movie", exact: true }).click();
  const tv = page.getByRole("radio", { name: /TV \/ Full HD/ });
  await expect(tv).toBeVisible();
  await page
    .getByText("Format, quality & export range", { exact: true })
    .click();
  await page.getByLabel("Export format", { exact: true }).selectOption("wav");
  await expect(tv).toBeHidden();
  await expect(page.getByText("Where will it be watched?")).toHaveCount(0);
});
