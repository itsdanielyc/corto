import { beforeEach, afterEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { FileProjectRepository } from "../../electron/storage";
import {
  importNativeSelection,
  processNativeMedia,
} from "../../electron/media-jobs";
import { nativeAudioSamples } from "../../electron/audio-samples";
import { createProject, addAsset, createScene } from "../../src/domain/project";
import { mediaOperationSchema } from "../../contracts/services";
import { preferencesSchema } from "../../contracts/creative";

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "corto-creator-service-"));
});
afterEach(async () => {
  if (basename(directory).startsWith("corto-creator-service-"))
    await rm(directory, { recursive: true, force: true });
});

it("retains several saved versions and preserves the latest while duplicating, renaming and deleting metadata", async () => {
  const repository = new FileProjectRepository(join(directory, "workspace"));
  const first = createProject("First cut");
  await repository.saveProject(first);
  const second = { ...first, name: "Second cut" };
  await repository.saveProject(second);
  await repository.saveProject({ ...second, name: "Latest cut" });
  const versions = await repository.listVersions(first.id);
  expect(versions).toHaveLength(2);
  const restored = await repository.restoreVersion(
    first.id,
    versions.find((version) => version.name === "First cut")!.id,
  );
  expect(restored.id).not.toBe(first.id);
  expect((await repository.openProject(first.id)).name).toBe("Latest cut");
  const copy = await repository.projectAction({
    operation: "duplicate",
    id: first.id,
  });
  expect(copy!.id).not.toBe(first.id);
  await repository.projectAction({
    operation: "rename",
    id: copy!.id,
    name: "Holiday",
  });
  expect((await repository.openProject(copy!.id)).name).toBe("Holiday");
  await repository.projectAction({ operation: "delete", id: copy!.id });
  expect(
    (await repository.listProjects()).some(
      (project) => project.id === copy!.id,
    ),
  ).toBe(false);
  expect((await repository.openProject(first.id)).name).toBe("Latest cut");
  const settings = preferencesSchema.parse({
    locale: "es",
    defaults: { photoSeconds: 8 },
    output: { resolution: "2160p" },
  });
  await repository.savePreferences(settings);
  expect(await repository.loadPreferences()).toEqual(settings);
});

it("imports an actual legacy AVI through bundled FFmpeg and makes independent local derivatives", async () => {
  const source = join(directory, "old-camera.avi");
  execFileSync(
    ffmpeg!,
    [
      "-loglevel",
      "error",
      "-i",
      join(process.cwd(), "tests/fixtures/motion.mp4"),
      "-c:v",
      "msmpeg4v2",
      "-c:a",
      "pcm_s16le",
      source,
    ],
    { windowsHide: true },
  );
  const originalBytes = await readFile(source);
  const repository = new FileProjectRepository(join(directory, "workspace"));
  const signal = new AbortController().signal;
  const imported = await importNativeSelection(
    ffmpeg!,
    repository,
    source,
    "old-camera.avi",
    signal,
  );
  expect(imported.original?.mime).toBe("video/x-msvideo");
  expect(imported.asset.mime).toBe("video/mp4");
  expect(await readFile(repository.assetPath(imported.original!.id))).toEqual(
    originalBytes,
  );
  let project = addAsset(
    addAsset(createProject(), imported.original!),
    imported.asset,
  );
  project = { ...project, scenes: [createScene(imported.asset)] };
  const frame = await processNativeMedia(
    ffmpeg!,
    repository,
    project,
    mediaOperationSchema.parse({
      assetId: imported.asset.id,
      operation: "frame",
      start: 0.5,
    }),
    signal,
  );
  expect(frame.media?.asset).toMatchObject({
    kind: "image",
    mime: "image/png",
  });
  const audio = await processNativeMedia(
    ffmpeg!,
    repository,
    project,
    mediaOperationSchema.parse({
      assetId: imported.asset.id,
      operation: "audio",
      start: 0.25,
      duration: 1,
      speed: 0.5,
    }),
    signal,
  );
  expect(audio.media?.asset.duration).toBeCloseTo(2, 1);
  const samples = await nativeAudioSamples(ffmpeg!, repository, project, {
    assetId: imported.asset.id,
    start: 0.25,
    duration: 0.5,
    speed: 0.5,
    preservePitch: true,
  });
  expect(samples.length).toBe(8000);
  expect(samples.some((value) => Math.abs(value) > 0.01)).toBe(true);
  const proxy = await processNativeMedia(
    ffmpeg!,
    repository,
    project,
    mediaOperationSchema.parse({
      assetId: imported.asset.id,
      operation: "proxy",
    }),
    signal,
  );
  expect(proxy.media?.asset.isProxy).toBe(true);
  expect(proxy.media?.asset.duration).toBeCloseTo(imported.asset.duration, 1);
  expect(await readFile(repository.assetPath(imported.original!.id))).toEqual(
    originalBytes,
  );
}, 30000);
