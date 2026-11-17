import { afterEach, beforeEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { FileProjectRepository } from "../../electron/storage";
import { MovieRenderer } from "../../electron/movie-renderer";
import { createProject, createScene, addAsset } from "../../src/domain/project";
import type { MediaAsset } from "../../contracts/project";
import { inspectMovie } from "../helpers/movie-inspection";

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "corto-creative-test-"));
});
afterEach(async () => {
  if (basename(directory).startsWith("corto-creative-test-"))
    await rm(directory, { recursive: true, force: true });
});
function sample(path: string, time: number): number[] {
  return [
    ...execFileSync(
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
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "pipe:1",
      ],
      { windowsHide: true },
    ),
  ];
}
async function original(
  repository: FileProjectRepository,
  name: string,
): Promise<MediaAsset> {
  const path = join(process.cwd(), "tests/fixtures", name);
  const asset: MediaAsset = {
    id: name.replace(".", "-"),
    name,
    kind: "image",
    mime: "image/png",
    size: (await stat(path)).size,
    duration: 0,
    width: 160,
    height: 90,
  };
  await repository.putAsset(asset, path);
  return asset;
}

it("encodes real overlapping colour frames with one frame budget and preserves originals", async () => {
  const repository = new FileProjectRepository(join(directory, "workspace"));
  const red = await original(repository, "red.png");
  const blue = await original(repository, "blue.png");
  const bytes = await readFile(repository.assetPath(red.id));
  let project = addAsset(addAsset(createProject("Dissolve"), red), blue);
  project = {
    ...project,
    scenes: [
      {
        ...createScene(red),
        duration: 1.2,
        transition: "dissolve",
        transitionSeconds: 0.4,
      },
      { ...createScene(blue), duration: 1.2 },
    ],
  };
  const output = join(directory, "dissolve.mp4");
  await new MovieRenderer(ffmpeg!, repository).render(
    { project, resolution: "720p", overlays: [] },
    output,
    new AbortController().signal,
    () => undefined,
  );
  const movie = inspectMovie(output);
  expect(movie.duration).toBeCloseTo(2, 1);
  expect(sample(output, 0.3)[0]).toBeGreaterThan(200);
  const blended = sample(output, 1);
  expect(blended[0]).toBeGreaterThan(60);
  expect(blended[2]).toBeGreaterThan(60);
  expect(sample(output, 1.6)[2]).toBeGreaterThan(200);
  expect(await readFile(repository.assetPath(red.id))).toEqual(bytes);
}, 30000);

it("applies actual monochrome, rotation and pan/zoom to a range at 24 fps", async () => {
  const repository = new FileProjectRepository(join(directory, "workspace"));
  const red = await original(repository, "red.png");
  let project = addAsset(createProject("Camera"), red);
  const scene = createScene(red);
  project = {
    ...project,
    output: { ...project.output, fps: 24, encoder: "software" },
    scenes: [
      {
        ...scene,
        duration: 2,
        transform: { ...scene.transform, rotation: 90, motion: "zoom-in" },
        adjustments: { ...scene.adjustments, look: "mono" },
      },
    ],
  };
  const output = join(directory, "camera.mp4");
  await new MovieRenderer(ffmpeg!, repository).render(
    {
      project,
      resolution: "720p",
      overlays: [],
      range: { start: 0.5, end: 1.5 },
    },
    output,
    new AbortController().signal,
    () => undefined,
  );
  expect(inspectMovie(output).duration).toBeCloseTo(1, 1);
  const grey = sample(output, 0.4);
  expect(Math.max(...grey) - Math.min(...grey)).toBeLessThan(8);
  expect(grey[0]).toBeGreaterThan(35);
  expect(grey[0]).toBeLessThan(80);
}, 30000);
