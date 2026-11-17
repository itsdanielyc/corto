import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";
import { savedBrowserProject } from "../helpers/browser-project";

async function photos(page: Page) {
  await page.goto("/");
  await page
    .getByTestId("media-input")
    .setInputFiles([
      join(process.cwd(), "tests/fixtures/red.png"),
      join(process.cwd(), "tests/fixtures/blue.png"),
    ]);
  await expect(page.getByTestId("scene-card")).toHaveCount(2);
  await expect(page.getByTestId("save-status")).toHaveText(
    "Saved on this device",
  );
}
async function menu(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

test("picture, timed text and overlay edits persist and save a composed PNG", async ({
  page,
}, info) => {
  await photos(page);
  await page.getByRole("button", { name: "More scene tools" }).click();
  await page.getByRole("button", { name: "Rotate 90°", exact: true }).click();
  await page.getByLabel("Motion", { exact: true }).selectOption("zoom-in");
  await page.getByLabel("Look", { exact: true }).selectOption("mono");
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page
    .getByLabel("Text item words")
    .fill("Our family\nA long title stays editable");
  await page.getByRole("tab", { name: "Overlays", exact: true }).click();
  await page
    .getByRole("button", { name: "Add shape / sticker", exact: true })
    .click();
  await page.getByLabel("Shape or sticker").selectOption("heart");
  const violations = await new AxeBuilder({ page })
    .include(".creator-dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(violations.violations.map((value) => value.id)).toEqual([]);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save composed frame as PNG" })
    .click();
  const image = await download;
  expect(image.suggestedFilename()).toMatch(/-frame\.png$/);
  await image.saveAs(info.outputPath("composed.png"));
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect
    .poll(async () => (await savedBrowserProject(page)).scenes[0])
    .toMatchObject({
      transform: { rotation: 90, motion: "zoom-in" },
      adjustments: { look: "mono" },
      textItems: [{ text: "Our family\nA long title stays editable" }],
      layers: [{ shape: "heart" }],
    });
  await page.reload();
  await page.getByRole("button", { name: "More scene tools" }).click();
  await expect(page.getByLabel("Motion", { exact: true })).toHaveValue(
    "zoom-in",
  );
});

test("makes a separate editable themed slideshow and supports bulk scene clipboard shortcuts", async ({
  page,
}) => {
  await photos(page);
  const previous = await savedBrowserProject(page);
  await menu(page, "Make a slideshow");
  await page.getByLabel("Slideshow opening title").fill("Family Sunday");
  await page.getByLabel("Slideshow theme").selectOption("wedding");
  await page.getByLabel("Slideshow order").selectOption("name");
  await page.getByLabel("Seconds per photo").fill("2");
  await page.getByLabel("Seconds per photo").press("Tab");
  await page.getByRole("button", { name: "Create editable draft" }).click();
  await expect(page.getByTestId("scene-card")).toHaveCount(3);
  await expect(page.getByLabel("Project name")).toHaveValue("Family Sunday");
  await expect
    .poll(async () => (await savedBrowserProject(page)).id)
    .not.toBe(previous.id);
  const draft = await savedBrowserProject(page);
  expect(draft.scenes[1].transform.motion).toBe("zoom-in");
  expect(draft.scenes[1].transition).toBe("fade-white");
  await page.getByTestId("scene-card").nth(1).click();
  await page
    .getByTestId("scene-card")
    .nth(2)
    .click({ modifiers: ["Shift"] });
  expect(
    await page
      .getByTestId("scene-card")
      .evaluateAll(
        (cards) =>
          cards.filter((card) => card.getAttribute("aria-pressed") === "true")
            .length,
      ),
  ).toBe(2);
  await page.keyboard.press("ControlOrMeta+d");
  await expect(page.getByTestId("scene-card")).toHaveCount(5);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+v");
  await expect(page.getByTestId("scene-card")).toHaveCount(10);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("scene-card")).toHaveCount(5);
});

test("example avoids an untouched draft and versions restore without overwriting the latest film", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Try an example/ }).click();
  await expect(page.getByLabel("Project name")).toHaveValue("Mountain days");
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Untitled film", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByLabel("Project name").fill("Latest mountain edit");
  await page.getByLabel("Project name").press("Tab");
  await expect(page.getByTestId("save-status")).toHaveText(
    "Saved on this device",
  );
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await page
    .getByRole("button", { name: "Manage Latest mountain edit", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Version history", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Restore as copy/ })
    .first()
    .click();
  await expect(page.getByLabel("Project name")).toHaveValue(
    "Mountain days (version)",
  );
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Open Latest mountain edit",
      exact: true,
    }),
  ).toBeVisible();
});
