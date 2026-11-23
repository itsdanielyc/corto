import { expect, test } from "@playwright/test";
import { openExampleFilm } from "../helpers/browser-project";

test("cancelling the portable picker or a slideshow returns to Films", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "My films", exact: true }).click();
  const heading = page.getByRole("heading", { name: "Films", exact: true });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open portable project" }).click();
  await (await chooser).setFiles([]);
  await expect(heading).toBeVisible();
  await page.getByRole("button", { name: "Slideshow", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(heading).toBeVisible();
});

test("appearance cards support keyboard selection and persist the choice", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("save-status")).toHaveAttribute(
    "data-status",
    "blank",
  );
  await page.keyboard.press("ControlOrMeta+Comma");
  const light = page.getByRole("radio", { name: "Light", exact: true });
  const dark = page.getByRole("radio", { name: "Dark", exact: true });
  await light.click();
  await light.press("ArrowRight");
  await expect(dark).toBeChecked();
  await expect(dark).toBeFocused();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("tabbing out of the title-bar menu leaves Escape available to Settings", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("save-status")).toHaveAttribute(
    "data-status",
    "blank",
  );
  await page.keyboard.press("ControlOrMeta+Comma");
  await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
  await page.getByRole("button", { name: "Project actions" }).click();
  await page.getByRole("menuitem", { name: "About Corto" }).press("Tab");
  await expect(page.getByRole("menu", { name: "Project actions" })).toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Project name")).toBeVisible();
});

test("Escape returns focus to the film's Manage button and dismisses its delete confirmation", async ({
  page,
}) => {
  await openExampleFilm(page);
  await page.getByRole("button", { name: "My films", exact: true }).click();
  const manage = page.getByRole("button", { name: "Manage Mountain days" });
  await manage.click();
  const remove = page.getByRole("button", { name: "Delete film", exact: true });
  await remove.click();
  await page.getByRole("button", { name: "Keep film" }).press("Escape");
  await expect(manage).toBeFocused();
  await manage.press("Enter");
  await expect(remove).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep film" })).toHaveCount(0);
});

test.describe("Films on a touch screen", () => {
  test.use({
    hasTouch: true,
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  test("the poster shows how to manage a film before the first tap", async ({
    page,
  }) => {
    await openExampleFilm(page);
    await page
      .getByRole("button", { name: "Project actions", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "New film", exact: true }).click();
    const name = page.getByLabel("Project name");
    await expect(name).toHaveValue("Untitled film");
    await name.fill("Second film");
    await name.press("Tab");
    await page.getByRole("button", { name: "My films", exact: true }).tap();
    await page.getByRole("heading", { name: "Films", exact: true }).focus();
    const manage = page.getByRole("button", { name: "Manage Mountain days" });
    const actions = page.getByRole("button", { name: /^Manage / });
    await expect(actions).toHaveCount(2);
    await page.mouse.move(0, 0);
    await expect
      .poll(() =>
        actions.evaluateAll((buttons) =>
          buttons.map((button) => getComputedStyle(button).opacity),
        ),
      )
      .toEqual(["1", "1"]);
    await manage.tap();
    await expect(
      page.getByRole("button", { name: "Rename film", exact: true }),
    ).toBeVisible();
  });
});

for (const width of [320, 810]) {
  test(`the film management panel fits inside the Films page at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 });
    await openExampleFilm(page);
    await page.getByRole("button", { name: "My films", exact: true }).click();
    await page.getByRole("button", { name: "Manage Mountain days" }).click();
    const panel = page.locator(".film-panel");
    const sheet = (await page.locator(".home-sheet").boundingBox())!;
    await expect
      .poll(async () => (await panel.boundingBox())!.x)
      .toBeGreaterThanOrEqual(sheet.x);
  });
}
