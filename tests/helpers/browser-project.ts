import { expect, type Page } from "@playwright/test";
import type { Project } from "../../contracts/project";

/** Read the real persisted browser adapter, rather than inferring a saved edit from its toast. */
export async function savedBrowserProject(page: Page): Promise<Project> {
  return page.evaluate(async () => {
    const path = "/src/platform/browser-repository.ts";
    const { BrowserProjectRepository } = await import(path);
    return new BrowserProjectRepository().loadProject();
  });
}

export async function openExampleFilm(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Try an example" }).click();
  await expect(page.getByTestId("scene-card")).toHaveCount(4);
  await expect(page.getByTestId("preview-status")).toHaveText("Ready");
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
}
