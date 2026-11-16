import {
  _electron as electron,
  expect,
  test,
  type Page,
} from "@playwright/test";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import ffmpeg from "ffmpeg-static";
import {
  inspectMovie,
  movieAudio,
  toneMagnitude,
} from "../helpers/movie-inspection";
import { completeNativeExport } from "../helpers/native-export";

async function menu(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}
async function number(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel(label, { exact: true }).press("Tab");
}

// Time O(pixels), space O(pixels); the independent decoder inspects the actual burned subtitle region.
function subtitlePixels(path: string, time: number): number {
  const pixels = execFileSync(
    ffmpeg!,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      String(time),
      "-i",
      path,
      "-vf",
      "crop=iw:ih/5:0:ih*4/5,scale=320:36",
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "pipe:1",
    ],
    { windowsHide: true },
  );
  let bright = 0;
  for (let offset = 0; offset < pixels.length; offset += 3)
    if (
      pixels[offset] > 180 &&
      pixels[offset + 1] > 180 &&
      pixels[offset + 2] > 180
    )
      bright++;
  return bright / (pixels.length / 3);
}

test("phone originals, placed sound, subtitles, sharing sample and named films work through native IPC", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), "corto-essentials-shell-"));
  const output = join(directory, "Phone memories-sample.mp4");
  const app = await electron.launch({
    args: [
      ".",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
    env: {
      ...process.env,
      CORTO_E2E: "1",
      CORTO_WORKSPACE_ROOT: join(directory, "workspace"),
      CORTO_EXPORT_PATH: output,
    },
  });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await expect(page.getByTestId("save-status")).toHaveText(
      "Saved on this device",
    );
    await page.getByLabel("Project name").fill("Phone memories");
    await page.getByLabel("Project name").press("Tab");
    await page
      .getByTestId("media-input")
      .setInputFiles(join(process.cwd(), "tests/fixtures/phone.heic"));
    await expect(page.getByTestId("scene-card")).toHaveCount(1);
    await number(page, "Duration (seconds)", "3");
    await page
      .getByTestId("media-input")
      .setInputFiles(join(process.cwd(), "tests/fixtures/phone-hdr.mp4"));
    await expect(page.getByTestId("scene-card")).toHaveCount(2);
    await page
      .getByRole("button", { name: "Add title card", exact: true })
      .click();
    await page.getByLabel("On-screen title").fill("");
    await number(page, "Duration (seconds)", "3");
    await menu(page, "Sound & narration");
    await page
      .getByTestId("sound-input")
      .setInputFiles(join(process.cwd(), "tests/fixtures/music.mp3"));
    await expect(page.getByLabel("Sound 1 duration")).toBeVisible();
    await page.getByLabel("Loop source within this duration").check();
    await number(page, "Sound 1 duration", "6.5");
    await number(page, "Sound 1 starts in film", "0.5");
    await number(page, "Sound 1 starts in source", "0.25");
    await expect(page.getByLabel("Sound 1 starts in source")).toHaveValue(
      "0.25",
    );
    await number(page, "Sound 1 fade in", "0.5");
    await number(page, "Sound 1 fade out", "0.5");
    await page.getByLabel("Lower music under clip sound and narration").check();
    await page
      .getByRole("button", { name: "Record narration", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: /Recording locally · 1s/ }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Stop and add narration", exact: true })
      .click();
    await expect(page.getByLabel("Sound 2 role")).toHaveValue("voiceover");
    await mkdir("artifacts/e2e", { recursive: true });
    const platform = await app.evaluate(
      () => `${process.platform}-${process.arch}`,
    );
    await page.screenshot({ path: `artifacts/e2e/${platform}-sound.png` });
    await page.getByLabel("Close dialog").click();
    await menu(page, "Timed subtitles");
    await page.getByTestId("subtitle-input").setInputFiles({
      name: "memories.srt",
      mimeType: "application/x-subrip",
      buffer: Buffer.from(
        "1\n00:00:00,800 --> 00:00:01,600\nFamily memories\n\n2\n00:00:02,400 --> 00:00:03,200\nTogether again\n",
      ),
    });
    await expect(page.getByLabel("Subtitle 2 text")).toHaveValue(
      "Together again",
    );
    await page.screenshot({ path: `artifacts/e2e/${platform}-subtitles.png` });
    await page.getByLabel("Close dialog").click();
    await expect(page.getByTestId("save-status")).toHaveText(
      "Saved on this device",
    );
    const project = await page.evaluate(() =>
      window.electronBridge!.loadProject(),
    );
    expect(
      Object.values(project!.assets).filter((asset) => asset.isOriginalOnly),
    ).toHaveLength(2);
    expect(project!.audioClips).toHaveLength(2);
    expect(project!.subtitles).toHaveLength(2);
    await page
      .getByRole("button", { name: "Export movie", exact: true })
      .click();
    await page.getByRole("radio", { name: /Small file/ }).check();
    const exportStarted = Date.now();
    await completeNativeExport(
      page,
      page.getByRole("button", {
        name: "Export first 5 seconds as a sample",
        exact: true,
      }),
    );
    const completed = page.getByText("A little film. All yours.", {
      exact: true,
    });
    await expect(completed).toBeVisible();
    console.log(
      "NATIVE_EXPORT_DIAGNOSTIC",
      JSON.stringify({
        elapsedMs: Date.now() - exportStarted,
        completed: true,
      }),
    );
    const movie = inspectMovie(output);
    expect(movie).toMatchObject({ width: 1280, height: 720, audio: true });
    expect(movie.duration).toBeGreaterThan(4.95);
    expect(movie.duration).toBeLessThan(5.15);
    expect(subtitlePixels(output, 1.2)).toBeGreaterThan(
      subtitlePixels(output, 1.9) + 0.004,
    );
    const normalMusic = toneMagnitude(movieAudio(output, 2.0, 0.2), 880);
    const duckedMusic = toneMagnitude(movieAudio(output, 3.5, 0.2), 880);
    expect(normalMusic).toBeGreaterThan(0.005);
    expect(duckedMusic).toBeGreaterThan(0.001);
    expect(duckedMusic).toBeLessThan(normalMusic * 0.6);
    expect(toneMagnitude(movieAudio(output, 0.1, 0.2), 880)).toBeLessThan(
      normalMusic * 0.1,
    );
    expect((await readFile(output)).byteLength).toBeGreaterThan(1000);
    await page
      .getByRole("button", { name: "Back to my film", exact: true })
      .click();
    await page.getByRole("button", { name: "My films", exact: true }).click();
    await page.getByRole("button", { name: "New film", exact: true }).click();
    await page
      .getByRole("button", { name: "Start new film", exact: true })
      .click();
    await page.getByRole("button", { name: "My films", exact: true }).click();
    await page
      .getByRole("button", { name: "Open Phone memories", exact: true })
      .click();
    await expect(page.getByTestId("scene-card")).toHaveCount(3);
    await expect(page.getByTestId("save-status")).toHaveText(
      "Saved on this device",
    );
    await page.reload();
    await expect(page.getByTestId("scene-card")).toHaveCount(3);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    if (basename(directory).startsWith("corto-essentials-shell-"))
      await rm(directory, { recursive: true, force: true });
  }
});
