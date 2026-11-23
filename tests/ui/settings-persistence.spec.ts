import { expect, test, type Page } from "@playwright/test";
import type { Preferences } from "../../contracts/project";
import { savedBrowserProject } from "../helpers/browser-project";

async function openNewFilm(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("save-status")).toHaveAttribute(
    "data-status",
    "blank",
  );
}

test("a new title card uses the scene defaults chosen in Settings", async ({
  page,
}) => {
  await openNewFilm(page);
  await page.keyboard.press("ControlOrMeta+Comma");
  await page.getByRole("button", { name: "New scenes", exact: true }).click();
  await page.getByLabel("Default title style").selectOption("modern");
  await page.getByLabel("Default background").fill("#894321");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page
    .getByRole("button", { name: "Add title card", exact: true })
    .click();
  await expect
    .poll(async () => {
      const film = await savedBrowserProject(page);
      const title = film?.scenes.find(
        (scene) => scene.caption === "Your title here" && !scene.assetId,
      );
      return title && [title.captionStyle, title.background];
    })
    .toEqual(["modern", "#894321"]);
});

test("device settings preserve a film's own scene defaults and undo history", async ({
  page,
}) => {
  await openNewFilm(page);
  await page
    .getByRole("button", { name: "Add title card", exact: true })
    .click();
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  const film = await savedBrowserProject(page);
  await page.evaluate(async (film) => {
    const path = "/src/platform/browser-repository.ts";
    const { BrowserProjectRepository } = await import(path);
    await new BrowserProjectRepository().saveProject({
      ...film,
      defaults: { ...film.defaults, photoSeconds: 11 },
    });
  }, film);
  await page.reload();
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  await page.keyboard.press("ControlOrMeta+Comma");
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Prefer editing proxies when available" })
    .check();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = "/src/platform/browser-repository.ts";
        const { BrowserProjectRepository } = await import(path);
        return (await new BrowserProjectRepository().loadPreferences())
          .proxyEditing;
      }),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  expect((await savedBrowserProject(page)).defaults.photoSeconds).toBe(11);
});

test("a slow settings write cannot replace a later edit when leaving the page", async ({
  page,
}) => {
  await openNewFilm(page);
  await page.evaluate(async () => {
    const path = "/src/platform/browser-repository.ts";
    const { BrowserProjectRepository } = await import(path);
    const repository = BrowserProjectRepository.prototype;
    const save = repository.savePreferences;
    repository.savePreferences = async function (input: Preferences) {
      repository.savePreferences = save;
      await new Promise<void>((resolve) => {
        document.addEventListener("release-preference-write", () => resolve(), {
          once: true,
        });
        document.dispatchEvent(new Event("preference-write-started"));
      });
      await save.call(this, input);
      document.dispatchEvent(new Event("preference-write-finished"));
    };
  });
  const started = page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        document.addEventListener("preference-write-started", () => resolve(), {
          once: true,
        }),
      ),
  );
  await page.keyboard.press("ControlOrMeta+Comma");
  await page.getByRole("button", { name: "New scenes", exact: true }).click();
  const duration = page.getByRole("spinbutton", {
    name: "Default photo duration",
  });
  await duration.fill("7");
  await duration.press("Enter");
  await started;
  await duration.fill("9");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        document.addEventListener(
          "preference-write-finished",
          () => resolve(),
          { once: true },
        );
        document.dispatchEvent(new Event("release-preference-write"));
      }),
  );
  await page.keyboard.press("ControlOrMeta+Comma");
  await page.getByRole("button", { name: "New scenes", exact: true }).click();
  await expect(duration).toHaveValue("9");
  await expect
    .poll(async () => (await savedBrowserProject(page))?.defaults.photoSeconds)
    .toBe(9);
});

test("a settings write failure stays visible after leaving Settings", async ({
  page,
}) => {
  await openNewFilm(page);
  await page.evaluate(async () => {
    const path = "/src/platform/browser-repository.ts";
    const { BrowserProjectRepository } = await import(path);
    BrowserProjectRepository.prototype.savePreferences = async () => {
      throw new Error("Settings storage is full");
    };
  });
  await page.keyboard.press("ControlOrMeta+Comma");
  await page.getByRole("button", { name: "New scenes", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Default photo duration" })
    .fill("8");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Settings storage is full",
  );
});
