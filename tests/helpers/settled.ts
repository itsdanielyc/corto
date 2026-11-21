import type { Page } from "@playwright/test";

/**
 * Waits until every finite CSS animation and transition has finished, so
 * accessibility checks measure the settled interface rather than a dialog
 * halfway through fading in. Looping animations (spinners) are ignored.
 */
export async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
}
