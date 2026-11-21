import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import {
  inspectMovie,
  movieAudio,
  toneMagnitude,
  titlePixelFraction,
} from "../helpers/movie-inspection";

async function photo(page: import("@playwright/test").Page, seconds = "0.5") {
  await page.goto("/");
  await page
    .getByTestId("media-input")
    .setInputFiles(join(process.cwd(), "tests/fixtures/red.png"));
  await expect(page.getByTestId("scene-card")).toHaveCount(1);
  await page.getByRole("tab", { name: "Timing", exact: true }).click();
  await page.getByLabel("Duration (seconds)").fill(seconds);
  await page.getByLabel("Duration (seconds)").press("Tab");
}
test("background export keeps its original film and title while another film is opened", async ({
  page,
}, info) => {
  await photo(page, "1");
  await page.getByLabel("Project name").fill("Queued original");
  await page.getByLabel("Project name").press("Tab");
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  await page.getByLabel("On-screen title").fill("ORIGINAL");
  await page.getByRole("button", { name: "Export movie", exact: true }).click();
  await page
    .getByText("A smaller file, easy to share", { exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export MP4", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Continue editing while exporting",
      exact: true,
    })
    .click();
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  await page.getByLabel("On-screen title").fill("");
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "New film", exact: true }).click();
  await page
    .getByRole("button", { name: "Start new film", exact: true })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Queued original.mp4");
  const path = info.outputPath("queued.mp4");
  await file.saveAs(path);
  expect(titlePixelFraction(path, 0.4)).toBeGreaterThan(0.002);
  await expect(page.getByTestId("scene-card")).toHaveCount(0);
  await expect(page.getByLabel("Project name")).toHaveValue("Untitled film");
});
test("exports a bounded animated GIF and an actual audio-only WAV", async ({
  page,
}, info) => {
  await photo(page);
  await page
    .getByTestId("music-input")
    .setInputFiles(join(process.cwd(), "tests/fixtures/music.mp3"));
  for (const format of ["gif", "wav"] as const) {
    await page
      .getByRole("button", { name: "Export movie", exact: true })
      .click();
    await page
      .getByText("Format, quality & export range", { exact: true })
      .click();
    await page
      .getByLabel("Export format", { exact: true })
      .selectOption(format);
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: `Export ${format.toUpperCase()}`,
        exact: true,
      })
      .click();
    const file = await download;
    const path = info.outputPath(`output.${format}`);
    await file.saveAs(path);
    if (format === "gif") {
      expect((await readFile(path)).subarray(0, 3).toString()).toBe("GIF");
      expect(inspectMovie(path)).toMatchObject({
        width: 960,
        height: 540,
        audio: false,
      });
    } else {
      expect((await readFile(path)).subarray(0, 4).toString()).toBe("RIFF");
      expect(toneMagnitude(movieAudio(path, 0.15, 0.2), 880)).toBeGreaterThan(
        0.003,
      );
    }
    await page
      .getByRole("button", { name: "Back to my film", exact: true })
      .click();
  }
});

test("a waiting background export can be cancelled independently of the running film", async ({
  page,
}) => {
  await photo(page);
  // Hold the real encoder download to keep one job running while the next is queued.
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/ffmpeg-core.wasm", async (route) => {
    await ready;
    await route.continue();
  });
  const queueExport = async (name: string) => {
    const title = page.getByLabel("Project name");
    await title.fill(name);
    await title.press("Tab");
    await page
      .getByRole("button", { name: "Export movie", exact: true })
      .click();
    await page.getByRole("button", { name: "Export MP4", exact: true }).click();
    await page
      .getByRole("button", { name: "Continue editing while exporting" })
      .click();
  };
  try {
    await queueExport("In progress");
    await queueExport("Waiting film");
    const cancelWaiting = page.getByRole("button", {
      name: "Cancel queued export Waiting film",
    });
    await expect(cancelWaiting).toBeVisible();
    await cancelWaiting.click();
    await expect(cancelWaiting).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Cancel queued export In progress" }),
    ).toBeVisible();
    const movie = page.waitForEvent("download");
    release();
    expect((await movie).suggestedFilename()).toBe("In progress.mp4");
    const notice = page.getByRole("complementary", { name: "Export queue" });
    await expect(notice.getByText("In progress.mp4")).toBeVisible();
    const heading = (await page.locator(".inspector-heading").boundingBox())!;
    const tray = (await notice.boundingBox())!;
    expect(tray.y + tray.height).toBeLessThanOrEqual(heading.y);
    await test.info().attach("finished-export", {
      body: await page.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
  } finally {
    release();
  }
});
