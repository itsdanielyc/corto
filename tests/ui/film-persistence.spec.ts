import { expect, test } from "@playwright/test";
import { savedBrowserProject } from "../helpers/browser-project";

test("failed local writes allow navigation once the current edit has a saved copy", async ({
  page,
}) => {
  await page.goto("/");
  const name = page.getByLabel("Project name");
  await name.fill("Saved locally");
  await name.press("Tab");
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  await page.evaluate(async () => {
    const path = "/src/platform/browser-repository.ts";
    const { BrowserProjectRepository } = await import(path);
    BrowserProjectRepository.prototype.saveProject = async () => {
      throw new Error("Local storage is full");
    };
  });
  await page.getByRole("button", { name: "My films", exact: true }).click();
  const films = page.getByRole("heading", { name: "Films", exact: true });
  await expect(films).toBeVisible();
  await page.getByRole("button", { name: "Back to my film" }).click();
  await name.fill("Latest edit");
  await name.press("Tab");
  await expect(page.getByTestId("save-status")).toHaveText("Not saved");
  const newFilm = async () => {
    await page.getByRole("button", { name: "Project actions" }).click();
    await page.getByRole("menuitem", { name: "New film", exact: true }).click();
  };
  await newFilm();
  await expect(page.getByRole("alert")).toContainText("Local storage is full");
  await expect(name).toHaveValue("Latest edit");
  const download = page.waitForEvent("download");
  await page.keyboard.press("ControlOrMeta+s");
  expect((await download).suggestedFilename()).toBe("Latest edit.corto");
  await newFilm();
  await expect(name).toHaveValue("Untitled film");
});

test("removing the last title card from an unnamed saved film survives a reload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add title card", exact: true })
    .click();
  const status = page.getByTestId("save-status");
  await expect(status).toHaveText("Saved");
  const original = await savedBrowserProject(page);
  await page.getByRole("button", { name: "Delete scene", exact: true }).click();
  await expect(status).toHaveText("Saved");
  await page.reload();
  await expect(status).toHaveText("Saved");
  expect(await savedBrowserProject(page)).toMatchObject({
    id: original.id,
    scenes: [],
  });
  await expect(page.getByTestId("scene-card")).toHaveCount(0);
});

test("Films keeps a new film whose only edit is its aspect ratio", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("save-status")).toHaveAttribute(
    "data-status",
    "blank",
  );
  await page
    .getByRole("radiogroup", { name: "Film shape" })
    .getByRole("radio", { name: "Portrait" })
    .click();
  await page.getByRole("button", { name: "My films", exact: true }).click();
  const open = page.getByRole("button", {
    name: "Open Untitled film",
    exact: true,
  });
  await expect(open).toBeVisible();
  await open.click();
  expect(await savedBrowserProject(page)).toMatchObject({
    ratio: "portrait",
    scenes: [],
  });
});
