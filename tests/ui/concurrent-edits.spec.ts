import { expect, test } from "@playwright/test";
import {
  openExampleFilm,
  savedBrowserProject,
} from "../helpers/browser-project";

test("importing subtitles preserves edits made while the local file is being read", async ({
  page,
}) => {
  await openExampleFilm(page);
  await page.getByRole("button", { name: "Project actions" }).click();
  await page.getByRole("menuitem", { name: "Timed subtitles" }).click();
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = async function () {
      await new Promise<void>((resolve) =>
        window.addEventListener("finish-srt-read", () => resolve(), {
          once: true,
        }),
      );
      return read.call(this);
    };
  });
  await page.getByTestId("subtitle-input").setInputFiles({
    name: "captions.srt",
    mimeType: "application/x-subrip",
    buffer: Buffer.from("1\n00:00:00,000 --> 00:00:01,000\nFirst cue\n"),
  });
  await page
    .getByRole("button", { name: "Add title card", exact: true })
    .click();
  await expect(page.getByTestId("scene-card")).toHaveCount(5);
  await page.evaluate(() => window.dispatchEvent(new Event("finish-srt-read")));
  await expect(page.getByLabel("Subtitle 1 text")).toHaveValue("First cue");
  await expect
    .poll(async () => {
      const saved = await savedBrowserProject(page);
      return [saved.scenes.length, saved.subtitles[0]?.text];
    })
    .toEqual([5, "First cue"]);
});

test("auto enhance stays attached to its original photo if another scene is selected", async ({
  page,
}) => {
  await openExampleFilm(page);
  const before = (await savedBrowserProject(page)).scenes;
  await page.evaluate(async () => {
    const path = "/src/platform/browser-repository.ts";
    const { BrowserProjectRepository } = await import(path);
    const repository = BrowserProjectRepository.prototype;
    const original = repository.assetUrl;
    repository.assetUrl = async function (id: string) {
      repository.assetUrl = original;
      await new Promise<void>((resolve) =>
        window.addEventListener("finish-photo-read", () => resolve(), {
          once: true,
        }),
      );
      return original.call(this, id);
    };
  });
  await page.getByRole("button", { name: "Auto enhance" }).click();
  await page.getByTestId("scene-card").nth(1).click();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("finish-photo-read")),
  );
  await expect
    .poll(async () => (await savedBrowserProject(page)).scenes[0].adjustments)
    .not.toEqual(before[0].adjustments);
  expect((await savedBrowserProject(page)).scenes[1].adjustments).toEqual(
    before[1].adjustments,
  );
});

for (const entry of ["Films template", "slideshow wizard"] as const) {
  test(`leaving the ${entry} while it saves keeps the current film open`, async ({
    page,
  }) => {
    await openExampleFilm(page);
    const original = await savedBrowserProject(page);
    if (entry === "Films template") {
      await page.getByRole("button", { name: "My films" }).click();
      await expect(
        page.getByRole("button", { name: "Family album template" }),
      ).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Project actions" }).click();
      await page.getByRole("menuitem", { name: "Make a slideshow" }).click();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.getByLabel("Slideshow soundtrack").selectOption("theme");
    }
    // Opening Films can schedule its own autosave. Arm the gate only after
    // the draft has stored its soundtrack, immediately before it saves.
    await page.evaluate(async () => {
      const path = "/src/platform/browser-repository.ts";
      const { BrowserProjectRepository } = await import(path);
      const repository = BrowserProjectRepository.prototype;
      const put = repository.putAsset;
      repository.putAsset = async function (...args: unknown[]) {
        repository.putAsset = put;
        await put.apply(this, args);
        const save = repository.saveProject;
        repository.saveProject = async function (...saveArgs: unknown[]) {
          repository.saveProject = save;
          await save.apply(this, saveArgs);
          window.dispatchEvent(new Event("draft-save-pending"));
          await new Promise<void>((resolve) =>
            window.addEventListener("finish-draft-save", () => resolve(), {
              once: true,
            }),
          );
        };
      };
    });
    const pending = page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          window.addEventListener("draft-save-pending", () => resolve(), {
            once: true,
          }),
        ),
    );
    const action =
      entry === "Films template"
        ? "Family album template"
        : "Create editable draft";
    await page.getByRole("button", { name: action }).click();
    await pending;
    const close =
      entry === "Films template" ? "Back to my film" : "Close dialog";
    await page.getByRole("button", { name: close }).click();
    await page
      .getByRole("button", { name: "Add title card", exact: true })
      .click();
    await page.evaluate(async () => {
      window.dispatchEvent(new Event("finish-draft-save"));
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    await expect(page.getByLabel("Project name")).toHaveValue(original.name);
    await expect
      .poll(async () => (await savedBrowserProject(page)).scenes.length)
      .toBe(original.scenes.length + 1);
  });
}
