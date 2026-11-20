import { test, expect } from "@playwright/test";
import { inspectMovie } from "../helpers/movie-inspection";

test("the production web app caches its shell and exports a film entirely offline", async ({
  page,
  context,
}, info) => {
  await page.addInitScript(() => {
    const supported = MediaRecorder.isTypeSupported.bind(MediaRecorder);
    MediaRecorder.isTypeSupported = (mime) =>
      !mime.startsWith("video/mp4") && supported(mime);
  });
  page.on("requestfailed", (request) =>
    console.log("Offline request failed:", request.url(), request.failure()),
  );
  page.on("pageerror", (error) =>
    console.log("Offline page error:", error.message),
  );
  await page.goto("/");
  await expect(page.getByTestId("editor-shell")).toHaveAttribute(
    "data-backend",
    "web",
  );
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("editor-shell")).toHaveAttribute(
    "data-backend",
    "web",
  );
  await page.getByRole("button", { name: "Try an example" }).click();
  await expect(page.getByTestId("scene-card")).toHaveCount(4);
  await expect(page.getByTestId("preview-status")).toHaveText("Ready");
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  expect(await page.getByRole("alert").count()).toBe(0);
  for (let count = 4; count > 1; count--) {
    await page.getByTestId("scene-card").last().click();
    await page
      .getByRole("button", { name: "Delete scene", exact: true })
      .click();
    await expect(page.getByTestId("scene-card")).toHaveCount(count - 1);
  }
  await page.getByRole("tab", { name: "Timing", exact: true }).click();
  await page.getByLabel("Duration (seconds)").fill("0.5");
  await page.getByLabel("Duration (seconds)").press("Tab");
  await page.getByRole("button", { name: "Export movie" }).click();
  await page
    .getByText("A smaller file, easy to share", { exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export WebM", exact: true }).click();
  const movie = await download;
  const path = info.outputPath(movie.suggestedFilename());
  await movie.saveAs(path);
  const properties = inspectMovie(path);
  expect(properties.duration).toBeGreaterThan(0.3);
  expect(properties.duration).toBeLessThan(1.0);
});
