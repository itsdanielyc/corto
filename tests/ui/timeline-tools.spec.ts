import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { savedBrowserProject } from "../helpers/browser-project";
import AxeBuilder from "@axe-core/playwright";
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
  await expect(page.getByTestId("save-status")).toHaveText(
    "Saved on this device",
  );
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
  await page
    .getByLabel("Slideshow theme", { exact: true })
    .selectOption("memorial");
  await page
    .getByRole("button", { name: "Create editable draft", exact: true })
    .click();
  await expect(page.getByTestId("scene-card")).toHaveCount(4);
  await expect(page.getByLabel("On-screen title")).toHaveValue(
    "In loving memory",
  );
  await expect(page.getByTestId("save-status")).toHaveText(
    "Saved on this device",
  );
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
  await expect(page.getByTestId("save-status")).toHaveText(
    "Saved on this device",
  );
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
  await page.getByLabel("On-screen title").fill("The last moment");
  await expect(page.getByTestId("save-status")).toHaveText(
    "Saved on this device",
  );
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
