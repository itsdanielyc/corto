import {
  _electron as electron,
  test,
  expect,
  type Page,
} from "@playwright/test";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import {
  inspectMovie,
  movieAudio,
  toneMagnitude,
  titlePixelFraction,
} from "../helpers/movie-inspection";
import { completeNativeExport } from "../helpers/native-export";

async function duration(page: Page, value: string) {
  await page.getByRole("tab", { name: "Timing", exact: true }).click();
  await page.getByLabel("Duration (seconds)").fill(value);
  await page.getByLabel("Duration (seconds)").press("Tab");
}

test("a real user can import, trim, title, save, reopen and export an MP4 in the native app", async () => {
  const directory = await mkdtemp(join(tmpdir(), "corto-user-journey-"));
  const output = join(directory, "Family film.mp4");
  const portable = join(directory, "Family film.corto");
  const app = await electron.launch({
    args: ["."],
    env: {
      ...process.env,
      CORTO_E2E: "1",
      CORTO_WORKSPACE_ROOT: join(directory, "workspace"),
      CORTO_EXPORT_PATH: output,
      CORTO_PROJECT_PATH: portable,
    },
  });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (failure) => errors.push(failure.message));
    await expect(page.getByTestId("editor-shell")).toHaveAttribute(
      "data-backend",
      "native",
    );
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
    await page.getByRole("tab", { name: "Text", exact: true }).click();
    await page.getByLabel("On-screen title").fill("Hello, family.");
    await duration(page, "0.5");
    await page
      .getByTestId("music-input")
      .setInputFiles(join(process.cwd(), "tests/fixtures/music.mp3"));
    await expect(page.getByTestId("save-status")).toHaveText("Saved");
    await page.getByRole("button", { name: "Project actions" }).click();
    await page.getByRole("menuitem", { name: "Save portable copy" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Portable copy saved." }),
    ).toBeVisible();
    expect((await readFile(portable)).subarray(0, 8).toString()).toBe(
      "CORTO001",
    );
    await page.getByRole("button", { name: "Project actions" }).click();
    await page.getByRole("menuitem", { name: "New film" }).click();
    await page
      .getByRole("button", { name: "Start new film", exact: true })
      .click();
    await expect(page.getByTestId("scene-card")).toHaveCount(0);
    await page.getByRole("button", { name: "Project actions" }).click();
    await page.getByRole("menuitem", { name: "Open project" }).click();
    await expect(page.getByTestId("scene-card")).toHaveCount(3);
    try {
      await expect(page.getByTestId("preview-status")).toHaveText("Ready");
    } catch (error) {
      console.log(
        "Native preview alert:",
        await page.getByRole("alert").allTextContents(),
      );
      console.log(
        "Native media response:",
        await page.evaluate(async () => {
          const project = await window.electronBridge!.loadProject();
          return Promise.all(
            Object.values(project!.assets).map(async (asset) => {
              try {
                const response = await fetch(
                  window.electronBridge!.assetUrl(asset.id),
                );
                const bytes = new Uint8Array(await response.arrayBuffer());
                return {
                  name: asset.name,
                  expected: asset.size,
                  status: response.status,
                  size: bytes.length,
                  type: response.headers.get("content-type"),
                  signature: Array.from(bytes.slice(0, 12)),
                };
              } catch (failure) {
                return { name: asset.name, error: String(failure) };
              }
            }),
          );
        }),
      );
      throw error;
    }
    await page.getByRole("button", { name: "Export movie" }).click();
    await page
      .getByText("A smaller file, easy to share", { exact: true })
      .click();
    await completeNativeExport(
      page,
      page.getByRole("button", { name: "Export MP4", exact: true }),
    );
    await expect(
      page.getByText("Your film is ready", { exact: true }),
    ).toBeVisible();
    const movie = inspectMovie(output);
    expect(movie).toMatchObject({ width: 1280, height: 720, audio: true });
    expect(movie.duration).toBeGreaterThan(1.65);
    expect(movie.duration).toBeLessThan(1.9);
    expect(titlePixelFraction(output, 1.5)).toBeGreaterThan(0.002);
    const pcm = movieAudio(output, 0.7, 0.3);
    expect(toneMagnitude(pcm, 440)).toBeGreaterThan(0.01);
    expect(toneMagnitude(pcm, 880)).toBeGreaterThan(0.005);
    await page.getByRole("button", { name: "Back to my film" }).click();
    const platform = await app.evaluate(
      () => `${process.platform}-${process.arch}`,
    );
    await mkdir("artifacts/e2e", { recursive: true });
    await page.screenshot({ path: `artifacts/e2e/${platform}-editor.png` });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    if (basename(directory).startsWith("corto-user-journey-"))
      await rm(directory, { recursive: true, force: true });
  }
});
