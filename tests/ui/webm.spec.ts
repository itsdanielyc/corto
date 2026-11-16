import { test, expect } from "@playwright/test";
import { inspectMovie, titlePixelFraction } from "../helpers/movie-inspection";

test("WebM metadata indexes keyframe clusters so fast seeking remains decodable", async ({
  page,
}, info) => {
  await page.goto("/");
  const download = page.waitForEvent("download");
  await page.evaluate(async () => {
    const modulePath = "/src/export/finalize-webm.ts";
    const { finalizeWebm } = (await import(
      modulePath
    )) as typeof import("../../src/export/finalize-webm");
    const response = await fetch(
      "/tests/fixtures/recording-without-duration.webm",
    );
    const fixed = await finalizeWebm(
      await response.blob(),
      new AbortController().signal,
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(fixed);
    link.download = "seekable.webm";
    link.click();
  });
  const path = info.outputPath("seekable.webm");
  await (await download).saveAs(path);
  expect(inspectMovie(path)).toMatchObject({
    width: 1280,
    height: 720,
    audio: true,
  });
  expect(titlePixelFraction(path, 1.5)).toBeGreaterThan(0.002);
});
