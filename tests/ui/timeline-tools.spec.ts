import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { savedBrowserProject } from "../helpers/browser-project";
import AxeBuilder from "@axe-core/playwright";
import { settled } from "../helpers/settled";
import { readFile } from "node:fs/promises";
test("library drag inserts at the target and proportional ruler remains keyboard accessible", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("media-input")
    .setInputFiles([
      join(process.cwd(), "tests/fixtures/red.png"),
      join(process.cwd(), "tests/fixtures/blue.png"),
    ]);
  await expect(page.getByTestId("scene-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Add red.png", exact: true })
    .dragTo(page.getByTestId("scene-card").nth(1));
  await expect(page.getByTestId("scene-card")).toHaveCount(3);
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  const project = await savedBrowserProject(page);
  expect(
    project.scenes.map((scene) => project.assets[scene.assetId!].name),
  ).toEqual(["red.png", "blue.png", "red.png"]);
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Film tools & bulk edits", exact: true })
    .click();
  await page.getByLabel("Proportional timeline", { exact: true }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const ruler = page.getByRole("slider", {
    name: "Timeline ruler",
    exact: true,
  });
  await ruler.press("End");
  await expect(
    page.getByRole("slider", { name: "Playhead", exact: true }),
  ).toHaveValue("15");
  await ruler.press("Home");
  await expect(
    page.getByRole("slider", { name: "Playhead", exact: true }),
  ).toHaveValue("0");
  await settled(page);
  const accessibility = await new AxeBuilder({ page })
    .include(".storyboard")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations.map((violation) => violation.id)).toEqual([]);
});
test("starts an editable project template without importing fake media", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Make a slideshow", exact: true })
    .click();
  await page.getByLabel("Use a project template", { exact: true }).check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("radiogroup", { name: "Slideshow theme" })
    .getByRole("radio", { name: "In loving memory", exact: true })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Create editable draft", exact: true })
    .click();
  await expect(page.getByTestId("scene-card")).toHaveCount(4);
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  await expect(page.getByLabel("On-screen title")).toHaveValue(
    "In loving memory",
  );
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  expect(Object.keys((await savedBrowserProject(page)).assets)).toHaveLength(0);
});
test("opens and edits a 500-photo film through the real browser store", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("media-input")
    .setInputFiles(join(process.cwd(), "tests/fixtures/red.png"));
  await expect(page.getByTestId("scene-card")).toHaveCount(1);
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  await page.evaluate(async () => {
    const repositoryPath = "/src/platform/browser-repository.ts";
    const domainPath = "/src/domain/project.ts";
    const { BrowserProjectRepository } = await import(repositoryPath);
    const { createScene } = await import(domainPath);
    const repository = new BrowserProjectRepository();
    const project = await repository.loadProject();
    const asset = Object.values(project.assets)[0];
    await repository.saveProject({
      ...project,
      name: "500 moments",
      scenes: Array.from({ length: 500 }, () => ({
        ...createScene(asset),
        duration: 0.25,
      })),
    });
  });
  await page.reload();
  await expect(page.getByTestId("scene-card")).toHaveCount(500);
  await page.getByTestId("scene-card").last().click();
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  await page.getByLabel("On-screen title").fill("The last moment");
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  expect((await savedBrowserProject(page)).scenes[499].caption).toBe(
    "The last moment",
  );
  await page.getByRole("slider", { name: "Playhead", exact: true }).fill("0");
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(async () =>
      Number(
        await page
          .getByRole("slider", { name: "Playhead", exact: true })
          .inputValue(),
      ),
    )
    .toBeGreaterThan(0.5);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
});

test("library type sorting groups pictures and clips before applying the filename fallback", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("media-input").setInputFiles([
    {
      name: "z-photo.png",
      mimeType: "image/png",
      buffer: await readFile(join(process.cwd(), "tests/fixtures/red.png")),
    },
    {
      name: "a-video.mp4",
      mimeType: "video/mp4",
      buffer: await readFile(join(process.cwd(), "tests/fixtures/motion.mp4")),
    },
  ]);
  await expect(page.getByTestId("scene-card")).toHaveCount(2);
  await expect(
    page.getByRole("option", { name: "Media type", exact: true }),
  ).toHaveCount(1);
  await page.getByLabel("Library sort", { exact: true }).selectOption("type");
  const names = await page
    .getByRole("complementary", { name: "Media library", exact: true })
    .getByRole("button", { name: /^Add (z-photo\.png|a-video\.mp4)$/ })
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("aria-label")),
    );
  expect(names).toEqual(["Add z-photo.png", "Add a-video.mp4"]);
});
