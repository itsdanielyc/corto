import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import {
  addAsset,
  appendScene,
  createProject,
  createScene,
} from "../../src/domain/project";
import { FileProjectRepository } from "../../electron/storage";

test("native project commands save and reopen original media through the sandboxed preload", async () => {
  const directory = await mkdtemp(join(tmpdir(), "corto-shell-storage-"));
  const portable = join(directory, "Family film.corto");
  const app = await electron.launch({
    args: ["."],
    env: {
      ...process.env,
      CORTO_E2E: "1",
      CORTO_WORKSPACE_ROOT: join(directory, "workspace"),
      CORTO_PROJECT_PATH: portable,
    },
  });
  try {
    const page = await app.firstWindow();
    // An untouched film has loaded and claims nothing about saving.
    await expect(page.getByTestId("save-status")).toHaveAttribute(
      "data-status",
      "blank",
    );
    const asset = {
      id: "family-1",
      name: "Family.png",
      kind: "image" as const,
      mime: "image/png",
      size: 3,
      duration: 0,
      width: 1,
      height: 1,
    };
    const project = appendScene(
      addAsset(createProject("Family film"), asset),
      createScene(asset),
    );
    await page.evaluate(
      async ({ asset, project }) => {
        const bridge = window.electronBridge!;
        await bridge.putAsset(
          asset,
          new File([new Uint8Array([1, 2, 3])], asset.name, {
            type: asset.mime,
          }),
        );
        await bridge.saveProject(project);
      },
      { asset, project },
    );
    expect(
      await page.evaluate(() => window.electronBridge!.loadProject()),
    ).toEqual(project);
    expect(
      await page.evaluate(
        (project) => window.electronBridge!.savePortable(project),
        project,
      ),
    ).toBe(true);
    expect((await readFile(portable)).subarray(0, 8).toString()).toBe(
      "CORTO001",
    );
    const reopened = await page.evaluate(() =>
      window.electronBridge!.openPortable(),
    );
    expect(reopened?.name).toBe("Family film");
    expect(reopened?.scenes).toHaveLength(1);
    expect(reopened?.scenes[0].assetId).not.toBe(asset.id);
    const current = await page.evaluate(() =>
      window.electronBridge!.loadProject(),
    );
    expect(current).toEqual(reopened);
  } finally {
    await app.close();
    if (basename(directory).startsWith("corto-shell-storage-"))
      await rm(directory, { recursive: true, force: true });
  }
});

test("opens an OS-supplied portable path at cold launch without losing it to initial autosave", async () => {
  const directory = await mkdtemp(join(tmpdir(), "corto-open-path-"));
  const portable = join(directory, "A film from another computer.corto");
  const repository = new FileProjectRepository(join(directory, "source"));
  const project = {
    ...createProject("Opened from desktop"),
    scenes: [{ ...createScene(null), caption: "The selected portable film" }],
  };
  await repository.exportPortable(project, portable);
  const app = await electron.launch({
    args: [".", portable],
    env: {
      ...process.env,
      CORTO_E2E: "1",
      CORTO_WORKSPACE_ROOT: join(directory, "destination"),
    },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByLabel("Project name")).toHaveValue(
      "Opened from desktop",
    );
    await expect(page.getByTestId("scene-card")).toHaveCount(1);
    await expect(page.getByTestId("save-status")).toHaveText("Saved");
    const saved = await page.evaluate(() =>
      window.electronBridge!.loadProject(),
    );
    expect(saved!.id).not.toBe(project.id);
    expect(saved!.scenes[0].caption).toBe("The selected portable film");
  } finally {
    await app.close();
    if (basename(directory).startsWith("corto-open-path-"))
      await rm(directory, { recursive: true, force: true });
  }
});
