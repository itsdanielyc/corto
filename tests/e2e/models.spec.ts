import {
  _electron as electron,
  test,
  expect,
  type Page,
} from "@playwright/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";

async function menu(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}
async function captions(page: Page) {
  const previous = await page.evaluate(async () => {
    const project = await window.electronBridge!.loadProject();
    return project?.subtitles[0]?.id;
  });
  await menu(page, "Timed subtitles");
  await page
    .getByText("Automatic captions · works locally", { exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Download model / create caption draft",
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () => {
        const project = await page.evaluate(() =>
          window.electronBridge!.loadProject(),
        );
        return project?.subtitles[0]?.id !== previous
          ? project?.subtitles
              .map((cue) => cue.text)
              .join(" ")
              .toLowerCase()
          : "";
      },
      { timeout: 120000 },
    )
    .toContain("americans");
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
}

test("real native models recognise speech, matte a local SVG copy and reuse model data after an offline restart", async () => {
  test.skip(
    !process.env.CORTO_MODEL_TESTS,
    "Cold native model proof runs in the dedicated model matrix",
  );
  test.setTimeout(240000);
  const directory = await mkdtemp(join(tmpdir(), "corto-model-shell-"));
  const workspace = join(directory, "workspace");
  const speech = join(directory, "speech.wav");
  const response = await fetch(
    "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav",
  );
  if (!response.ok) throw new Error("Public speech fixture unavailable");
  const full = join(directory, "public-speech.wav");
  await writeFile(full, Buffer.from(await response.arrayBuffer()));
  execFileSync(
    ffmpeg!,
    [
      "-loglevel",
      "error",
      "-i",
      full,
      "-t",
      "8",
      "-ar",
      "16000",
      "-ac",
      "1",
      speech,
    ],
    { windowsHide: true },
  );
  const packagedExecutable = process.env.CORTO_PACKAGED_EXECUTABLE;
  const privateProfile = join(workspace, "runtime-profile");
  const launch = async () => {
    const application = await electron.launch({
      ...(packagedExecutable ? { executablePath: packagedExecutable } : {}),
      args: packagedExecutable ? [`--user-data-dir=${privateProfile}`] : ["."],
      env: { ...process.env, CORTO_E2E: "1", CORTO_WORKSPACE_ROOT: workspace },
    });
    if (packagedExecutable) {
      const profile = await application.evaluate(({ app }) =>
        app.getPath("userData"),
      );
      if (profile !== privateProfile) {
        await application.close();
        throw new Error(
          "Packaged model proof requires its own private profile",
        );
      }
    }
    return application;
  };
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await expect(page.getByTestId("editor-shell")).toHaveAttribute(
      "data-backend",
      "native",
    );
    await page
      .getByRole("button", { name: "Add title card", exact: true })
      .click();
    await page.getByRole("tab", { name: "Timing", exact: true }).click();
    await page.getByLabel("Duration (seconds)").fill("8");
    await page.getByLabel("Duration (seconds)").press("Tab");
    await page.getByTestId("music-input").setInputFiles(speech);
    await menu(page, "Sound & narration");
    await page
      .getByLabel("Sound 1 role", { exact: true })
      .selectOption("voiceover");
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .click();
    await captions(page);
    const first = await page.evaluate(() =>
      window.electronBridge!.loadProject(),
    );
    expect(
      first!.subtitles
        .map((cue) => cue.text)
        .join(" ")
        .toLowerCase(),
    ).toContain("americans");
    await page
      .getByTestId("media-input")
      .setInputFiles(join(process.cwd(), "tests/fixtures/plant.svg"));
    await expect(page.getByTestId("scene-card")).toHaveCount(2);
    await expect(page.getByTestId("save-status")).toHaveText("Saved");
    const before = await page.evaluate(() =>
      window.electronBridge!.loadProject(),
    );
    const photo = before!.scenes[1].assetId!;
    await page.getByRole("tab", { name: "Picture", exact: true }).click();
    await page
      .getByText("Remove photo background locally", { exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Download model / remove background",
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () => {
          const project = await page.evaluate(() =>
            window.electronBridge!.loadProject(),
          );
          return project?.scenes[1]?.assetId ?? photo;
        },
        { timeout: 120000 },
      )
      .not.toBe(photo);
    const saved = await page.evaluate(() =>
      window.electronBridge!.loadProject(),
    );
    const matte = await page.evaluate(async (id) => {
      const response = await fetch(window.electronBridge!.assetUrl(id));
      const image = await createImageBitmap(await response.blob());
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      return {
        corner: pixels[3],
        pot: pixels[(380 * image.width + 256) * 4 + 3],
      };
    }, saved!.scenes[1].assetId!);
    expect(matte.corner).toBeLessThan(30);
    expect(matte.pot).toBeGreaterThan(200);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    const writes: string[] = [];
    page.on("request", (request) => {
      if (!["GET", "HEAD"].includes(request.method()))
        writes.push(request.url());
    });
    await page
      .context()
      .route("https://huggingface.co/**", (route) => route.abort());
    await captions(page);
    const reopened = await page.evaluate(() =>
      window.electronBridge!.loadProject(),
    );
    expect(reopened!.subtitles[0].id).not.toBe(first!.subtitles[0].id);
    expect(writes).toEqual([]);
  } finally {
    await app.close();
    if (basename(directory).startsWith("corto-model-shell-"))
      await rm(directory, { recursive: true, force: true });
  }
});
