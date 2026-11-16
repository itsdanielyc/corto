import { it, expect } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import ffmpeg from "ffmpeg-static";
import { FileProjectRepository } from "../../electron/storage";
import { importPhoneVideo } from "../../electron/phone-import";
import {
  addAsset,
  appendScene,
  createProject,
  createScene,
} from "../../src/domain/project";
import { inspectMovie } from "../helpers/movie-inspection";

it("tone maps a real HEVC/HDR phone clip locally and preserves its original through a portable project", async () => {
  const directory = await mkdtemp(join(tmpdir(), "corto-phone-test-"));
  try {
    const repository = new FileProjectRepository(join(directory, "workspace"));
    const input = join(process.cwd(), "tests/fixtures/phone-hdr.mp4");
    const imported = await importPhoneVideo(
      ffmpeg!,
      repository,
      input,
      "Phone holiday.mp4",
    );
    expect(imported.original?.isOriginalOnly).toBe(true);
    expect(imported.asset.originalAssetId).toBe(imported.original?.id);
    const video = inspectMovie(repository.assetPath(imported.asset.id));
    expect(video.video).toMatch(/h264/);
    expect(video.video).toMatch(/bt709/);
    expect(video.duration).toBeGreaterThan(0.9);
    expect(
      new Uint8Array(
        await readFile(repository.assetPath(imported.original!.id)),
      ),
    ).toEqual(new Uint8Array(await readFile(input)));
    const project = appendScene(
      addAsset(addAsset(createProject(), imported.original!), imported.asset),
      createScene(imported.asset),
    );
    const portable = join(directory, "phone.corto");
    await repository.exportPortable(project, portable);
    const restored = new FileProjectRepository(join(directory, "restored"));
    const reopened = await restored.importPortable(portable);
    const playback = reopened.assets[reopened.scenes[0].assetId!];
    const original = reopened.assets[playback.originalAssetId!];
    expect(original.isOriginalOnly).toBe(true);
    expect(
      new Uint8Array(await readFile(restored.assetPath(original.id))),
    ).toEqual(new Uint8Array(await readFile(input)));
  } finally {
    if (basename(directory).startsWith("corto-phone-test-"))
      await rm(directory, { recursive: true, force: true });
  }
});
