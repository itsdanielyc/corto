import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { addAsset, appendScene, createProject, createScene } from "../../src/domain/project";

test("native project commands save and reopen original media through the sandboxed preload", async () => {
  const directory = await mkdtemp(join(tmpdir(), "corto-shell-storage-"));
  const portable = join(directory, "Family film.corto");
  const app = await electron.launch({ args: ["."], env: { ...process.env, CORTO_E2E: "1", CORTO_WORKSPACE_ROOT: join(directory, "workspace"), CORTO_PROJECT_PATH: portable } });
  try {
    const window = await app.firstWindow();
    const asset = { id: "family-1", name: "Family.png", kind: "image" as const, mime: "image/png", size: 3, duration: 0, width: 1, height: 1 };
    const project = appendScene(addAsset(createProject("Family film"), asset), createScene(asset));
    await window.evaluate(async ({ asset, project }) => {
      const bridge = window.electronBridge!;
      await bridge.putAsset(asset, new File([new Uint8Array([1, 2, 3])], asset.name, { type: asset.mime }));
      await bridge.saveProject(project);
    }, { asset, project });
    expect(await window.evaluate(() => window.electronBridge!.loadProject())).toEqual(project);
    expect(await window.evaluate(project => window.electronBridge!.savePortable(project), project)).toBe(true);
    expect((await readFile(portable)).subarray(0, 8).toString()).toBe("CORTO001");
    const reopened = await window.evaluate(() => window.electronBridge!.openPortable());
    expect(reopened?.name).toBe("Family film");
    expect(reopened?.scenes).toHaveLength(1);
    expect(reopened?.scenes[0].assetId).not.toBe(asset.id);
    const current = await window.evaluate(() => window.electronBridge!.loadProject());
    expect(current).toEqual(reopened);
  } finally {
    await app.close();
    if (basename(directory).startsWith("corto-shell-storage-")) await rm(directory, { recursive: true, force: true });
  }
});
