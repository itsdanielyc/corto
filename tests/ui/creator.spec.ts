import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { settled } from "../helpers/settled";
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
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
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
  await page.getByRole("button", { name: "Rotate 90°", exact: true }).click();
  await page
    .getByRole("radiogroup", { name: "Motion", exact: true })
    .getByRole("radio", { name: "Slow zoom in", exact: true })
    .click();
  await page
    .getByRole("radiogroup", { name: "Look", exact: true })
    .getByRole("radio", { name: "Black & white", exact: true })
    .click();
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
  await page.getByLabel("Emoji sticker", { exact: true }).fill("🎈");
  await page
    .getByRole("button", { name: "Add emoji sticker", exact: true })
    .click();
  await settled(page);
  const violations = await new AxeBuilder({ page })
    .include(".inspector")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(violations.violations.map((value) => value.id)).toEqual([]);
  await page.getByRole("tab", { name: "Picture", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save composed frame as PNG" })
    .click();
  const image = await download;
  expect(image.suggestedFilename()).toMatch(/-frame\.png$/);
  await image.saveAs(info.outputPath("composed.png"));
  await expect
    .poll(async () => (await savedBrowserProject(page)).scenes[0])
    .toMatchObject({
      transform: { rotation: 90, motion: "zoom-in" },
      adjustments: { look: "mono" },
      textItems: [
        { text: "Our family\nA long title stays editable" },
        { text: "🎈" },
      ],
      layers: [{ shape: "heart" }],
    });
  await page.reload();
  await expect(
    page
      .getByRole("radiogroup", { name: "Motion", exact: true })
      .getByRole("radio", { name: "Slow zoom in", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
});

test("makes a separate editable themed slideshow and supports bulk scene clipboard shortcuts", async ({
  page,
}) => {
  await photos(page);
  const previous = await savedBrowserProject(page);
  await menu(page, "Make a slideshow");
  await page.getByLabel("Slideshow order").selectOption("name");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Slideshow opening title").fill("Family Sunday");
  await page
    .getByRole("radiogroup", { name: "Slideshow theme" })
    .getByRole("radio", { name: "Wedding", exact: true })
    .click();
  await page.getByLabel("Seconds per photo").fill("2");
  await page.getByLabel("Seconds per photo").press("Tab");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Slideshow soundtrack").selectOption("theme");
  await page.getByRole("button", { name: "Create editable draft" }).click();
  await expect(page.getByTestId("scene-card")).toHaveCount(3);
  await expect(page.getByLabel("Project name")).toHaveValue("Family Sunday");
  await expect
    .poll(async () => (await savedBrowserProject(page)).id)
    .not.toBe(previous.id);
  const draft = await savedBrowserProject(page);
  expect(draft.audioClips).toHaveLength(1);
  expect(draft.assets[draft.audioClips[0].assetId].name).toContain(
    "Together always",
  );
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
  await page.getByRole("button", { name: "Back to my film" }).click();
  await page.getByLabel("Project name").fill("Latest mountain edit");
  await page.getByLabel("Project name").press("Tab");
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
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
