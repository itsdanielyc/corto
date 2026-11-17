import type { Page } from "@playwright/test";
import type { Project } from "../../contracts/project";

/** Read the real persisted browser adapter, rather than inferring a saved edit from its toast. */
export async function savedBrowserProject(page: Page): Promise<Project> {
  return page.evaluate(async () => {
    const path = "/src/platform/browser-repository.ts";
    const { BrowserProjectRepository } = await import(path);
    return new BrowserProjectRepository().loadProject();
  });
}
