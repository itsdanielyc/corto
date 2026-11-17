import { expect, it } from "vitest";
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
import { mediaOperationSchema } from "../../contracts/services";
import { addAsset, createProject, createScene } from "../../src/domain/project";
import { inspectMovie } from "../helpers/movie-inspection";

function pixel(path: string, time: number): Buffer {
  return execFileSync(
    ffmpeg!,
    [
      "-loglevel",
      "error",
      "-ss",
      String(time),
      "-i",
      path,
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
}
it("detects real shot changes and reverses across bounded chunks without altering the original", async () => {
  const directory = await mkdtemp(join(tmpdir(), "corto-media-proof-"));
  try {
    const source = join(directory, "two-shots.mp4");
    execFileSync(
      ffmpeg!,
      [
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=320x180:r=24:d=3",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=320x180:r=24:d=3",
        "-filter_complex",
        "[0:v][1:v]concat=n=2:v=1:a=0[v]",
        "-map",
        "[v]",
        "-an",
        "-c:v",
        "libx264",
        "-threads",
        "1",
        "-pix_fmt",
        "yuv420p",
        source,
      ],
      { windowsHide: true },
    );
    const original = await readFile(source);
    const repository = new FileProjectRepository(join(directory, "workspace"));
    const signal = new AbortController().signal;
    const imported = await importNativeSelection(
      ffmpeg!,
      repository,
      source,
      "two-shots.mp4",
      signal,
    );
    const project = addAsset(createProject(), imported.asset);
    project.scenes = [createScene(imported.asset)];
    const cuts = await processNativeMedia(
      ffmpeg!,
      repository,
      project,
      mediaOperationSchema.parse({
        assetId: imported.asset.id,
        operation: "scenes",
        threshold: 0.3,
      }),
      signal,
    );
    expect(cuts.boundaries).toEqual([3]);
    const reverse = await processNativeMedia(
      ffmpeg!,
      repository,
      project,
      mediaOperationSchema.parse({
        assetId: imported.asset.id,
        operation: "reverse",
      }),
      signal,
    );
    const output = repository.assetPath(reverse.media!.asset.id);
    expect(inspectMovie(output).duration).toBeCloseTo(6, 1);
    expect(pixel(output, 0.2)[2]).toBeGreaterThan(220);
    expect(pixel(output, 5.7)[0]).toBeGreaterThan(220);
    expect(await readFile(repository.assetPath(imported.asset.id))).toEqual(
      original,
    );
  } finally {
    if (basename(directory).startsWith("corto-media-proof-"))
      await rm(directory, { recursive: true, force: true });
  }
}, 30000);

it("imports TIFF as a portable PNG copy and preserves GIF animation instead of a frozen poster", async () => {
  const directory = await mkdtemp(join(tmpdir(), "corto-picture-proof-"));
  try {
    const repository = new FileProjectRepository(join(directory, "workspace"));
    const signal = new AbortController().signal;
    const tiff = join(directory, "photo.tiff");
    execFileSync(
      ffmpeg!,
      [
        "-loglevel",
        "error",
        "-i",
        join(process.cwd(), "tests/fixtures/red.png"),
        "-frames:v",
        "1",
        tiff,
      ],
      { windowsHide: true },
    );
    const photo = await importNativeSelection(
      ffmpeg!,
      repository,
      tiff,
      "photo.tiff",
      signal,
    );
    expect(photo.asset).toMatchObject({
      kind: "image",
      mime: "image/png",
      duration: 0,
    });
    expect(await readFile(repository.assetPath(photo.original!.id))).toEqual(
      await readFile(tiff),
    );
    expect(pixel(repository.assetPath(photo.asset.id), 0)[0]).toBeGreaterThan(
      220,
    );
    const gif = join(directory, "animation.gif");
    execFileSync(
      ffmpeg!,
      [
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=160x90:r=4:d=1",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=160x90:r=4:d=1",
        "-filter_complex",
        "[0:v][1:v]concat=n=2:v=1:a=0[v]",
        "-map",
        "[v]",
        "-threads",
        "1",
        gif,
      ],
      { windowsHide: true },
    );
    const animation = await importNativeSelection(
      ffmpeg!,
      repository,
      gif,
      "animation.gif",
      signal,
    );
    expect(animation.asset).toMatchObject({
      kind: "video",
      mime: "video/mp4",
      animated: true,
      hasAudio: false,
    });
    const path = repository.assetPath(animation.asset.id);
    expect(inspectMovie(path).duration).toBeCloseTo(2, 1);
    expect(pixel(path, 0.2)[0]).toBeGreaterThan(220);
    expect(pixel(path, 1.5)[2]).toBeGreaterThan(220);
    expect(
      await readFile(repository.assetPath(animation.original!.id)),
    ).toEqual(await readFile(gif));
  } finally {
    if (basename(directory).startsWith("corto-picture-proof-"))
      await rm(directory, { recursive: true, force: true });
  }
}, 30000);
