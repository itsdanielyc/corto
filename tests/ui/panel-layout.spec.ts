import { expect, test, type Page } from "@playwright/test";
import { openExampleFilm } from "../helpers/browser-project";
import { settled } from "../helpers/settled";

/** Phone sheets, a compact desktop and the default desktop window. */
const WINDOW_SIZES = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 1024, height: 700 },
  { width: 1440, height: 900 },
] as const;
const SCENE_TABS = ["Picture", "Text", "Overlays", "Timing"] as const;
const SIDE_PANELS = [
  "Sound & narration",
  "Timed subtitles",
  "Film tools & bulk edits",
] as const;

/**
 * Opens every collapsed section of a scrolling panel body, then lists what a
 * person could see sticking out of its padding or needing a sideways scroll.
 * An empty list means every control sits inside the panel.
 */
async function outsidePanel(page: Page, selector: string): Promise<string[]> {
  const body = page.locator(selector);
  await expect(body).toBeVisible();
  // Sections can nest, so open whichever closed one is showing until none is left.
  const closed = body.locator("details:not([open]) > summary:visible");
  while (await closed.count()) await closed.first().click({ timeout: 5000 });
  await settled(page);
  return body.evaluate((panel) => {
    const style = getComputedStyle(panel);
    const bounds = panel.getBoundingClientRect();
    const left = bounds.left + panel.clientLeft + parseFloat(style.paddingLeft);
    const right =
      bounds.left +
      panel.clientLeft +
      panel.clientWidth -
      parseFloat(style.paddingRight);
    const name = (element: Element) =>
      `${element.tagName.toLowerCase()}${[...element.classList].map((value) => `.${value}`).join("")}`;
    // What shows of an element: its box cut down by every clipping ancestor
    // inside the panel (a zooming thumbnail never leaves its rounded frame).
    const shown = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      let { left, right } = box;
      for (
        let parent = element.parentElement;
        parent && parent !== panel;
        parent = parent.parentElement
      ) {
        if (getComputedStyle(parent).overflowX === "visible") continue;
        const clip = parent.getBoundingClientRect();
        left = Math.max(left, clip.left);
        right = Math.min(right, clip.right);
      }
      return { left, right, width: right - left, height: box.height };
    };
    const problems = [...panel.querySelectorAll<HTMLElement>("*")]
      .filter((element) => element.checkVisibility())
      .map((element) => ({ element, box: shown(element) }))
      .filter(
        ({ box }) =>
          box.width > 0 &&
          box.height > 0 &&
          (box.right > right + 0.5 || box.left < left - 0.5),
      )
      .map(
        ({ element, box }) =>
          `${name(element)} is ${Math.round(Math.max(box.right - right, left - box.left))}px outside`,
      );
    if (panel.scrollWidth > panel.clientWidth)
      problems.unshift(
        `scrolls sideways by ${panel.scrollWidth - panel.clientWidth}px`,
      );
    return problems;
  });
}

for (const size of WINDOW_SIZES) {
  test(`every scene tool stays inside the inspector at ${size.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openExampleFilm(page);
    const editSheet = page.getByRole("button", { name: "Edit", exact: true });
    if (await editSheet.isVisible()) await editSheet.click();
    for (const tab of SCENE_TABS) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      // Give the Text and Overlays tabs their per-item controls.
      if (tab === "Text")
        await page
          .getByRole("button", { name: "Heading", exact: true })
          .click();
      if (tab === "Overlays")
        await page
          .getByRole("button", { name: "Add emoji sticker", exact: true })
          .click();
      expect.soft(await outsidePanel(page, ".inspector-body"), tab).toEqual([]);
    }
    if (await editSheet.isVisible()) await editSheet.click();
    await page.getByTestId("scene-card").last().click();
    if (await editSheet.isVisible()) await editSheet.click();
    await page.getByRole("tab", { name: "Card", exact: true }).click();
    expect
      .soft(await outsidePanel(page, ".inspector-body"), "Card")
      .toEqual([]);
    await page
      .getByTestId("media-input")
      .setInputFiles("tests/fixtures/motion.mp4");
    await page.getByRole("tab", { name: "Clip", exact: true }).click();
    expect
      .soft(await outsidePanel(page, ".inspector-body"), "Clip")
      .toEqual([]);
  });

  test(`sound, subtitles and bulk edits fit their side panel at ${size.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openExampleFilm(page);
    for (const panel of SIDE_PANELS) {
      await page
        .getByRole("button", { name: "Project actions", exact: true })
        .click();
      await page.getByRole("menuitem", { name: panel, exact: true }).click();
      const close = page.getByRole("button", {
        name: "Close panel",
        exact: true,
      });
      // The whole close button is on screen, not clipped by the window edge.
      await expect.soft(close, panel).toBeInViewport({ ratio: 1 });
      expect.soft(await outsidePanel(page, ".panel-body"), panel).toEqual([]);
      // Escape closes a panel wherever its close button happens to be.
      await page.locator(".panel-title h2").press("Escape");
      await expect(close).toHaveCount(0);
    }
  });
}

test("the transition picker and its actions stay on a small phone screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openExampleFilm(page);
  await page
    .getByRole("button", { name: /^Transition after scene 1:/ })
    .click();
  const picker = page.getByRole("dialog", { name: "Transition after scene 1" });
  await expect(picker).toBeInViewport({ ratio: 1 });
  await picker.getByRole("radio", { name: "Cross dissolve" }).click();
  await expect(picker.getByRole("button", { name: "Done" })).toBeInViewport({
    ratio: 1,
  });
});
