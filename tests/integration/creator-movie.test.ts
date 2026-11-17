import { afterEach, beforeEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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

it("renders actual chroma transparency and an imported 3D LUT into independently decoded pixels", async () => {
  const repository = new FileProjectRepository(join(directory, "workspace"));
  const greenPath = join(directory, "green.png");
  execFileSync(
    ffmpeg!,
    [
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=0x00ff00:s=160x90",
      "-frames:v",
      "1",
      "-threads",
      "1",
      greenPath,
    ],
    { windowsHide: true },
  );
  const green: MediaAsset = {
    id: "green",
    name: "green.png",
    kind: "image",
    mime: "image/png",
    size: (await stat(greenPath)).size,
    duration: 0,
    width: 160,
    height: 90,
  };
  await repository.putAsset(green, greenPath);
  let project = addAsset(createProject("Chroma"), green);
  project = {
    ...project,
    output: { ...project.output, encoder: "software", fps: 24 },
    scenes: [
      {
        ...createScene(green),
        duration: 0.5,
        keyColour: "#00ff00",
        background: "#ff0000",
      },
    ],
  };
  const keyed = join(directory, "keyed.mp4");
  await new MovieRenderer(ffmpeg!, repository).render(
    { project, resolution: "720p", overlays: [] },
    keyed,
    new AbortController().signal,
    () => {},
  );
  const keyPixel = sample(keyed, 0.2);
  expect(keyPixel[0]).toBeGreaterThan(220);
  expect(keyPixel[1]).toBeLessThan(30);
  const red = await original(repository, "red.png");
  const cube =
    "LUT_3D_SIZE 2\n1 1 1\n0 1 1\n1 0 1\n0 0 1\n1 1 0\n0 1 0\n1 0 0\n0 0 0\n";
  const cubePath = join(directory, "invert.cube");
  await writeFile(cubePath, cube);
  const lut: MediaAsset = {
    id: "invert",
    name: "invert.cube",
    kind: "lut",
    mime: "application/x-cube",
    size: Buffer.byteLength(cube),
    duration: 0,
    width: 0,
    height: 0,
  };
  await repository.putAsset(lut, cubePath);
  project = addAsset(addAsset(project, red), lut);
  const scene = createScene(red);
  project = {
    ...project,
    scenes: [
      {
        ...scene,
        duration: 0.5,
        adjustments: { ...scene.adjustments, lutAssetId: lut.id },
      },
    ],
  };
  const output = join(directory, "look.mp4");
  await new MovieRenderer(ffmpeg!, repository).render(
    { project, resolution: "720p", overlays: [] },
    output,
    new AbortController().signal,
    () => {},
  );
  const cyan = sample(output, 0.2);
  expect(cyan[0]).toBeLessThan(30);
  expect(cyan[1]).toBeGreaterThan(220);
  expect(cyan[2]).toBeGreaterThan(220);
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
