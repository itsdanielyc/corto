import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { assertGeometry, captureGeometry } from "./geometry";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/e8AAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("editor-shell")).toHaveAttribute(
    "data-backend",
    "mock",
  );
});

async function example(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Try an example" }).click();
  await expect(page.getByLabel("Project name")).toHaveValue("Mountain days");
  await expect(page.getByTestId("scene-card")).toHaveCount(4);
  await expect(page.getByTestId("preview-status")).toHaveText("Ready");
  await expect(page.getByTestId("library-loading")).toHaveCount(0);
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
}

test("example film can be edited, duplicated, reordered and undone", async ({
  page,
}) => {
  await example(page);
  await page.getByTestId("scene-card").first().click();
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  await page.getByLabel("On-screen title").fill("A summer to remember");
  await page
    .getByRole("button", { name: "Duplicate scene", exact: true })
    .click();
  await expect(page.getByTestId("scene-card")).toHaveCount(5);
  expect(
    Number(await page.getByRole("slider", { name: "Playhead" }).inputValue()),
  ).toBeGreaterThan(5);
  await page
    .getByRole("button", { name: "Move scene right", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("scene-card")).toHaveCount(4);
  await page.getByLabel("Aspect ratio").selectOption("portrait");
  await expect(page.getByTestId("preview-canvas")).toHaveAttribute(
    "data-ratio",
    "portrait",
  );
});

test("local imports persist after reload and title cards are editable by keyboard", async ({
  page,
}) => {
  await page.getByTestId("media-input").setInputFiles([
    { name: "Family.png", mimeType: "image/png", buffer: png },
    { name: "Weekend.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(page.getByTestId("scene-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Add title card", exact: true })
    .click();
  await expect(page.getByTestId("scene-card")).toHaveCount(3);
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  await page.getByLabel("On-screen title").fill("Hello, family");
  await page.getByRole("tab", { name: "Timing", exact: true }).click();
  await page.getByLabel("Duration (seconds)").fill("3");
  await page.getByLabel("Duration (seconds)").press("Tab");
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByTestId("scene-card")).toHaveCount(3);
  await page.getByRole("button", { name: /Scene \d+: Hello, family$/ }).click();
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  await expect(page.getByLabel("On-screen title")).toHaveValue("Hello, family");
  await page.getByRole("button", { name: "Delete scene", exact: true }).click();
  await expect(page.getByTestId("scene-card")).toHaveCount(2);
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+z" : "Control+z",
  );
  await expect(page.getByTestId("scene-card")).toHaveCount(3);
});

test("portable projects download and reopen with their original photos", async ({
  page,
}, info) => {
  await page
    .getByTestId("media-input")
    .setInputFiles({ name: "Family.png", mimeType: "image/png", buffer: png });
  await expect(page.getByTestId("scene-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Project actions" }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Save portable copy" }).click();
  const projectFile = info.outputPath("Family.corto");
  await (await downloaded).saveAs(projectFile);
  await page.getByRole("button", { name: "Project actions" }).click();
  await page.getByRole("menuitem", { name: "New film" }).click();
  await page
    .getByRole("button", { name: "Start new film", exact: true })
    .click();
  await expect(page.getByTestId("scene-card")).toHaveCount(0);
  await page.getByTestId("project-input").setInputFiles(projectFile);
  await expect(page.getByTestId("scene-card")).toHaveCount(1);
  await expect(page.getByTestId("preview-status")).toHaveText("Ready");
});

test("corrupt projects produce an actionable error and preserve the current film", async ({
  page,
}) => {
  await example(page);
  await page.getByTestId("project-input").setInputFiles({
    name: "broken.corto",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("broken"),
  });
  await expect(page.getByRole("alert")).toContainText("Corto project");
  await expect(page.getByLabel("Project name")).toHaveValue("Mountain days");
  await expect(page.getByTestId("scene-card")).toHaveCount(4);
});

test("tier 1 editor: named controls and landmark structure remain available", async ({
  page,
}) => {
  await example(page);
  await expect(page.getByTestId("editor-shell")).toMatchAriaSnapshot({
    name: "editor.aria.yml",
  });
});

test("tier 2 editor: the library, preview, inspector and storyboard retain their geometry", async ({
  page,
}) => {
  await example(page);
  assertGeometry(
    join(
      test.info().project.testDir,
      "__snapshots__",
      "editor.spec.ts",
      "editor.geometry.json",
    ),
    await captureGeometry(page),
  );
});

test("tier 3 editor: pixels match the reviewed platform baseline", async ({
  page,
}, info) => {
  await example(page);
  const name = `editor-${info.project.name}-${process.platform}.png`;
  test.skip(
    !process.env.CI &&
      !existsSync(
        join(info.project.testDir, "__snapshots__", "editor.spec.ts", name),
      ),
    "Pixels are captured on hosted runners",
  );
  await expect(page).toHaveScreenshot(name, { fullPage: true });
});
