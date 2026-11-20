import { expect, test, type Page } from "@playwright/test";
import { savedBrowserProject } from "../helpers/browser-project";

async function example(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Try an example" }).click();
  await expect(page.getByTestId("scene-card")).toHaveCount(4);
  await expect(page.getByTestId("preview-status")).toHaveText("Ready");
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
}

test("a transition picked at the join between two scenes is saved, and can apply to every join", async ({
  page,
}) => {
  await example(page);
  await page
    .getByRole("button", { name: /^Transition after scene 1:/ })
    .click();
  const picker = page.getByRole("dialog", { name: "Transition after scene 1" });
  await picker.getByRole("radio", { name: "Cross dissolve" }).click();
  await expect
    .poll(async () => (await savedBrowserProject(page)).scenes[0].transition)
    .toBe("dissolve");
  await picker.getByRole("button", { name: "Use for every join" }).click();
  await expect
    .poll(async () =>
      (await savedBrowserProject(page)).scenes
        .slice(0, -1)
        .map((scene) => scene.transition),
    )
    .toEqual(["dissolve", "dissolve", "dissolve"]);
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Transition after scene 1:/ }),
  ).toBeFocused();
});

test("the command palette finds a command by a few letters and runs it from the keyboard", async ({
  page,
}) => {
  await example(page);
  await page.keyboard.press("ControlOrMeta+k");
  const search = page.getByRole("combobox", { name: "Search commands" });
  await expect(search).toBeFocused();
  await search.fill("show time");
  await expect(
    page.getByRole("option", { name: "Show timeline" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(search).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Timeline", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("start and end framing set on the picture become a custom camera move", async ({
  page,
}) => {
  await example(page);
  await page
    .getByRole("button", { name: "Set start and end on the picture" })
    .click();
  const start = page.getByRole("button", { name: /^Start frame\./ });
  await start.focus();
  await page.keyboard.press("+");
  await page.keyboard.press("Shift+ArrowDown");
  await expect
    .poll(async () => (await savedBrowserProject(page)).scenes[0].transform)
    .toMatchObject({ motion: "custom" });
  const transform = (await savedBrowserProject(page)).scenes[0].transform;
  expect(transform.zoom).toBeGreaterThan(1);
  expect(transform.focusY).toBeGreaterThan(0.5);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(start).toHaveCount(0);
  await expect(
    page
      .getByRole("radiogroup", { name: "Motion", exact: true })
      .getByRole("radio", { name: "Your framing", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
});

test("words are moved where they appear on the picture, by keyboard as well as by dragging", async ({
  page,
}) => {
  await example(page);
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  const handle = page.getByRole("button", { name: /^Move words: / });
  await expect(handle).toBeVisible();
  await expect
    .poll(
      async () => (await savedBrowserProject(page)).scenes[0].textItems.length,
    )
    .toBe(1);
  const before = (await savedBrowserProject(page)).scenes[0].textItems[0];
  await handle.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect
    .poll(
      async () => (await savedBrowserProject(page)).scenes[0].textItems[0].x,
    )
    .toBeCloseTo(before.x + 0.05, 5);
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 60, {
    steps: 4,
  });
  await page.mouse.up();
  await expect
    .poll(
      async () => (await savedBrowserProject(page)).scenes[0].textItems[0].y,
    )
    .toBeGreaterThan(before.y + 0.05);
});

test("the chosen appearance applies at once and survives a reload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Settings & defaults", exact: true })
    .click();
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  const background = () =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background()).toBe("rgb(14, 14, 16)");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background()).toBe("rgb(14, 14, 16)");
});
