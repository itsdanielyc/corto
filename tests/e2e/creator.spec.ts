import {
  _electron as electron,
  test,
  expect,
  type Page,
} from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { completeNativeExport } from "../helpers/native-export";
import {
  inspectMovie,
  movieAudio,
  toneMagnitude,
  titlePixelFraction,
} from "../helpers/movie-inspection";

async function range(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).evaluate((element, value) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}
test("real 4K60 native composition contains timed text and independently audible picture-in-picture", async () => {
  test.setTimeout(120000); // This new 4K/60 CPU encode has its own budget; existing native journeys keep their limits.
  const directory = await mkdtemp(join(tmpdir(), "corto-creator-shell-"));
  const output = join(directory, "Creator.mp4");
  const app = await electron.launch({
    args: ["."],
    env: {
      ...process.env,
      CORTO_E2E: "1",
      CORTO_WORKSPACE_ROOT: join(directory, "workspace"),
      CORTO_EXPORT_PATH: output,
    },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("editor-shell")).toHaveAttribute(
      "data-backend",
      "native",
    );
    await page
      .getByTestId("media-input")
      .setInputFiles([
        join(process.cwd(), "tests/fixtures/red.png"),
        join(process.cwd(), "tests/fixtures/motion.mp4"),
      ]);
    await expect(page.getByTestId("scene-card")).toHaveCount(2);
    await page.getByRole("tab", { name: "Timing", exact: true }).click();
    await page.getByLabel("Duration (seconds)").fill("1");
    await page.getByLabel("Duration (seconds)").press("Tab");
    await page.getByRole("tab", { name: "Text", exact: true }).click();
    await page.getByRole("button", { name: "Heading", exact: true }).click();
    await page.getByLabel("Text item words").fill("FAMILY");
    await page
      .getByLabel("Text animation", { exact: true })
      .selectOption("typewriter");
    await page.getByLabel("Font", { exact: true }).selectOption("rounded");
    await page.getByRole("tab", { name: "Overlays", exact: true }).click();
    await page
      .getByLabel("Overlay media", { exact: true })
      .selectOption({ label: "motion.mp4" });
    await page
      .getByRole("button", { name: "Add picture in picture", exact: true })
      .click();
    await range(page, "Overlay X position", "0.15");
    await range(page, "Overlay Y position", "0.15");
    await range(page, "Overlay sound volume", "1");
    await page
      .getByRole("button", { name: "Export movie", exact: true })
      .click();
    await page
      .getByText("Format, quality & export range", { exact: true })
      .click();
    await page
      .getByLabel("Export resolution", { exact: true })
      .selectOption("2160p");
    await page
      .getByLabel("Export frame rate", { exact: true })
      .selectOption("60");
    await page
      .getByLabel("Export portion", { exact: true })
      .selectOption("range");
    await page.getByLabel("Export range ends", { exact: true }).fill("1");
    await page.getByLabel("Export range ends", { exact: true }).press("Tab");
    await completeNativeExport(
      page,
      page.getByRole("button", { name: "Export MP4", exact: true }),
    );
    await expect(
      page.getByRole("heading", {
        name: "Your film is ready",
        exact: true,
      }),
    ).toBeVisible();
    const movie = inspectMovie(output);
    expect(movie).toMatchObject({ width: 3840, height: 2160, audio: true });
    expect(movie.duration).toBeCloseTo(1, 1);
    expect(movie.video).toMatch(/60 fps/);
    expect(titlePixelFraction(output, 0.7)).toBeGreaterThan(0.002);
    expect(titlePixelFraction(output, 0.05)).toBeLessThan(
      titlePixelFraction(output, 0.7) * 0.7,
    );
    expect(toneMagnitude(movieAudio(output, 0.2, 0.3), 440)).toBeGreaterThan(
      0.008,
    );
  } finally {
    await app.close();
    if (basename(directory).startsWith("corto-creator-shell-"))
      await rm(directory, { recursive: true, force: true });
  }
});
