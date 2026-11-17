import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { completeNativeExport } from "../helpers/native-export";
import { inspectMovie } from "../helpers/movie-inspection";

test("exports all 500 photos with exact cumulative timing and the final photo intact", async () => {
  test.skip(
    !process.env.CORTO_STRESS_TESTS,
    "Dedicated long-film proof; normal editing checks keep their short budget",
  );
  test.setTimeout(600000);
  const directory = await mkdtemp(join(tmpdir(), "corto-large-film-"));
  const output = join(directory, "500 moments.mp4");
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
    await page
      .getByTestId("media-input")
      .setInputFiles([
        join(process.cwd(), "tests/fixtures/red.png"),
        join(process.cwd(), "tests/fixtures/blue.png"),
      ]);
    await expect(page.getByTestId("scene-card")).toHaveCount(2);
    await expect(page.getByTestId("save-status")).toHaveText(
      "Saved on this device",
    );
    await page.evaluate(async () => {
      const bridge = window.electronBridge!;
      const project = (await bridge.loadProject())!;
      const red = project.scenes[0];
      const blue = project.scenes[1];
      await bridge.saveProject({
        ...project,
        name: "500 moments",
        scenes: Array.from({ length: 500 }, (_, index) => ({
          ...(index === 499 ? blue : red),
          id: crypto.randomUUID(),
          duration: 0.25,
          transition: "cut",
          caption: "",
        })),
        output: {
          ...project.output,
          fps: 24,
          resolution: "720p",
          encoder: "software",
        },
      });
    });
    await page.reload();
    await expect(page.getByTestId("scene-card")).toHaveCount(500);
    await page
      .getByRole("button", { name: "Export movie", exact: true })
      .click();
    await completeNativeExport(
      page,
      page.getByRole("button", { name: "Export MP4", exact: true }),
    );
    const movie = inspectMovie(output);
    expect(movie.duration).toBeCloseTo(125, 1);
    expect(movie).toMatchObject({ width: 1280, height: 720 });
    const pixel = execFileSync(
      ffmpeg!,
      [
        "-loglevel",
        "error",
        "-ss",
        "124.9",
        "-i",
        output,
        "-vf",
        "scale=1:1",
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
    expect(pixel.length).toBe(3);
    expect(pixel[2]).toBeGreaterThan(pixel[0] * 2);
  } finally {
    await app.close();
    if (basename(directory).startsWith("corto-large-film-"))
      await rm(directory, { recursive: true, force: true });
  }
});
