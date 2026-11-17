import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";
import {
  inspectMovie,
  movieAudio,
  toneMagnitude,
  titlePixelFraction,
} from "../helpers/movie-inspection";

async function duration(page: Page, value: string) {
  await page.getByLabel("Duration (seconds)").fill(value);
  await page.getByLabel("Duration (seconds)").press("Tab");
}

for (const recordingMode of [
  "automatic",
  "webm fallback",
  "slow decoder startup",
] as const) {
  test(`browser movie download contains real scene frames, clip sound and background music (${recordingMode})`, async ({
    page,
  }, info) => {
    test.skip(
      process.platform === "darwin" &&
        recordingMode === "automatic" &&
        !process.env.CORTO_RECORDING_DIAGNOSTIC,
      "Quarantined macOS recording truncation; issue #15, retained in the recording diagnostic",
    );
    test.skip(
      recordingMode !== "automatic" && !process.env.CORTO_ADVISORY_WEBM,
      "Experimental WebM capture is advisory; see the tracked Linux video-tail finding",
    );
    page.on("console", (message) => {
      if (message.type() === "error")
        console.log("Browser export diagnostic:", message.text());
    });
    if (recordingMode !== "automatic")
      await page.addInitScript(() => {
        const supported = MediaRecorder.isTypeSupported.bind(MediaRecorder);
        MediaRecorder.isTypeSupported = (mime) =>
          !mime.startsWith("video/mp4") && supported(mime);
      });
    if (recordingMode === "slow decoder startup")
      await page.addInitScript(() => {
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = async function () {
          await play.call(this);
          await new Promise((resolve) => setTimeout(resolve, 200));
        };
      });
    await page.goto("/");
    await page
      .getByTestId("media-input")
      .setInputFiles(join(process.cwd(), "tests/fixtures/red.png"));
    await expect(page.getByTestId("scene-card")).toHaveCount(1);
    await duration(page, "0.5");
    await page
      .getByTestId("media-input")
      .setInputFiles(join(process.cwd(), "tests/fixtures/motion.mp4"));
    await expect(page.getByTestId("scene-card")).toHaveCount(2);
    await page.getByLabel("Start in source (seconds)").fill("0.25");
    await page.getByLabel("Start in source (seconds)").press("Tab");
    await duration(page, "0.75");
    await page
      .getByRole("button", { name: "Add title card", exact: true })
      .click();
    await page.getByLabel("On-screen title").fill("Hello, family.");
    await duration(page, "0.5");
    await page
      .getByTestId("music-input")
      .setInputFiles(join(process.cwd(), "tests/fixtures/music.mp3"));
    await expect(page.getByTestId("save-status")).toHaveText(
      "Saved on this device",
    );
    await page.getByRole("button", { name: "Export movie" }).click();
    if (
      await page
        .getByText("For MP4 export, open this project in Corto for desktop.", {
          exact: false,
        })
        .count()
    ) {
      await expect(page.locator(".export-start")).toBeDisabled();
      return;
    }
    if (recordingMode !== "automatic")
      await page
        .getByText("A smaller file, easy to share", { exact: true })
        .click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /^Export (MP4|WebM)$/ }).click();
    const file = await download;
    const path = info.outputPath(file.suggestedFilename());
    await file.saveAs(path);
    await expect(
      page.getByText("A little film. All yours.", { exact: true }),
    ).toBeVisible();
    const movie = inspectMovie(path);
    expect(movie).toMatchObject(
      recordingMode === "automatic"
        ? { width: 1920, height: 1080, audio: true }
        : { width: 1280, height: 720, audio: true },
    );
    expect(movie.duration).toBeGreaterThan(1.5);
    expect(movie.duration).toBeLessThan(2.25);
    expect(titlePixelFraction(path, 1.5)).toBeGreaterThan(0.002);
    const pcm = movieAudio(path, 0.7, 0.3);
    expect(toneMagnitude(pcm, 440)).toBeGreaterThan(0.008);
    expect(toneMagnitude(pcm, 880)).toBeGreaterThan(0.003);
  });
}

test("a cancelled browser render produces no partial download and can be retried", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("media-input")
    .setInputFiles(join(process.cwd(), "tests/fixtures/red.png"));
  await expect(page.getByTestId("scene-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Export movie" }).click();
  if (
    await page
      .getByText("For MP4 export, open this project in Corto for desktop.", {
        exact: false,
      })
      .count()
  ) {
    await expect(page.locator(".export-start")).toBeDisabled();
    return;
  }
  await page
    .getByText("A smaller file, easy to share", { exact: true })
    .click();
  const downloads: string[] = [];
  page.on("download", (value) => downloads.push(value.suggestedFilename()));
  await page.getByRole("button", { name: /^Export (MP4|WebM)$/ }).click();
  await page
    .getByRole("button", { name: "Cancel export", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Export (MP4|WebM)$/ }),
  ).toBeEnabled();
  expect(downloads).toEqual([]);
});
