import { test, expect } from "@playwright/test";
import { join } from "node:path";
import {
  inspectMovie,
  movieAudio,
  toneMagnitude,
} from "../helpers/movie-inspection";

test("encodes a real MP4 locally when live MediaRecorder MP4 is unavailable", async ({
  page,
}, info) => {
  page.on("requestfailed", (request) =>
    console.log("ENCODER_FETCH_FAILURE", request.url(), request.failure()),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      console.log("ENCODER_CONSOLE", message.text());
  });
  await page.addInitScript(() => {
    MediaRecorder.isTypeSupported = () => false;
  });
  await page.goto("/");
  await page
    .getByTestId("media-input")
    .setInputFiles(join(process.cwd(), "tests/fixtures/motion.mp4"));
  await expect(page.getByTestId("scene-card")).toHaveCount(1);
  await page.getByLabel("Duration (seconds)").fill("0.5");
  await page.getByLabel("Duration (seconds)").press("Tab");
  await page.getByRole("button", { name: "Export movie", exact: true }).click();
  await page
    .getByText("A smaller file, easy to share", { exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export MP4", exact: true }).click();
  const file = await download;
  const path = info.outputPath("deterministic.mp4");
  await file.saveAs(path);
  expect(inspectMovie(path)).toMatchObject({
    width: 1280,
    height: 720,
    audio: true,
  });
  expect(inspectMovie(path).duration).toBeLessThan(0.7);
  expect(toneMagnitude(movieAudio(path, 0.1, 0.2), 440)).toBeGreaterThan(0.008);
});
