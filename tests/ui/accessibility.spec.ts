import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test("the editor has no detected WCAG A/AA violations and stays usable on a narrow screen", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try an example" }).click();
  await expect(page.getByTestId("scene-card")).toHaveCount(4);
  await expect(page.getByTestId("save-status")).toHaveText(
    "Saved on this device",
  );
  const desktop = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    desktop.violations.map((value) => ({
      id: value.id,
      nodes: value.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.getByRole("button", { name: "Export movie" }).click();
  const dialog = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    dialog.violations.map((value) => ({
      id: value.id,
      nodes: value.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("button", { name: "Export movie" }),
  ).toBeFocused();
});

test("Space plays and pauses the actual preview clock", async ({ page }) => {
  await page.goto("/");
  await page
    .getByTestId("media-input")
    .setInputFiles("tests/fixtures/motion.mp4");
  await expect(page.getByTestId("preview-status")).toHaveText("Ready");
  await page
    .getByRole("heading", { name: "Untitled film", exact: true })
    .click();
  const initial = Number(
    await page.getByRole("slider", { name: "Playhead" }).inputValue(),
  );
  const before = await page
    .getByTestId("preview-canvas")
    .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      Number(await page.getByRole("slider", { name: "Playhead" }).inputValue()),
    )
    .toBeGreaterThan(initial + 0.2);
  expect(
    await page
      .getByTestId("preview-canvas")
      .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL()),
  ).not.toBe(before);
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
});
