import { afterEach, beforeEach, expect, it } from "vitest";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { FileProjectRepository } from "../../electron/storage";
import { MovieRenderer } from "../../electron/movie-renderer";
import { createProject, createScene, addAsset } from "../../src/domain/project";
import type { MediaAsset, Project } from "../../contracts/project";
import { visualLayerSchema } from "../../contracts/creative";
import { inspectMovie } from "../helpers/movie-inspection";
import { transitionLayout } from "../../src/preview/transition-layout";

type VisualLayer = ReturnType<typeof visualLayerSchema.parse>;

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "corto-export-fix-"));
});
afterEach(async () => {
  if (basename(directory).startsWith("corto-export-fix-"))
    await rm(directory, { recursive: true, force: true });
});

/** One decoded RGB pixel at (x, y) of the frame at `time`, independent of the renderer. */
function pixel(path: string, time: number, x = 0.5, y = 0.5): number[] {
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
        `crop=2:2:iw*${x}-1:ih*${y}-1,scale=1:1`,
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

async function fixture(
  repository: FileProjectRepository,
  name: string,
  extra: Partial<MediaAsset> = {},
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
    ...extra,
  };
  await repository.putAsset(asset, path);
  return asset;
}

async function render(
  repository: FileProjectRepository,
  project: Project,
  name: string,
  range?: { start: number; end: number },
): Promise<string> {
  const output = join(directory, name);
  await new MovieRenderer(ffmpeg!, repository).render(
    { project, resolution: "720p", overlays: [], ...(range ? { range } : {}) },
    output,
    new AbortController().signal,
    () => undefined,
  );
  return output;
}

// The whole-film range routes through the shared creator pipeline that every
// desktop (render-assets token) and web export uses, not the legacy fallback.
const WHOLE_FILM = { start: 0, end: 2 };

it("fades a title card through black as neutral grey, not green", async () => {
  const repository = new FileProjectRepository(join(directory, "workspace"));
  let project = createProject("Fade card");
  project = {
    ...project,
    output: { ...project.output, encoder: "software" },
    scenes: [
      {
        ...createScene(null),
        caption: "",
        background: "#ffffff",
        duration: 2,
        transition: "fade",
        transitionSeconds: 0.6,
      },
    ],
  };
  const output = await render(repository, project, "card.mp4", WHOLE_FILM);
  expect(Math.min(...pixel(output, 1))).toBeGreaterThan(230);
  const half = pixel(output, 0.3);
  // Halfway through the fade-in, white is mid grey: every channel equal and darker.
  expect(Math.max(...half) - Math.min(...half)).toBeLessThan(12);
  expect(half[1]).toBeGreaterThan(70);
  expect(half[1]).toBeLessThan(190);
}, 30000);

it("fades a photo through black over its chosen duration without a colour cast", async () => {
  const repository = new FileProjectRepository(join(directory, "workspace"));
  const red = await fixture(repository, "red.png");
  let project = addAsset(createProject("Fade photo"), red);
  project = {
    ...project,
    output: { ...project.output, encoder: "software" },
    scenes: [
      {
        ...createScene(red),
        duration: 2,
        transition: "fade",
        transitionSeconds: 0.6,
      },
    ],
  };
  const output = await render(repository, project, "photo.mp4", WHOLE_FILM);
  expect(pixel(output, 1)[0]).toBeGreaterThan(200);
  const half = pixel(output, 0.3);
  // Halfway through a 0.6 s fade-in the red picture is darker red, never green or blue.
  expect(half[0]).toBeGreaterThan(60);
  expect(half[0]).toBeLessThan(200);
  expect(half[1]).toBeLessThan(40);
  expect(half[2]).toBeLessThan(40);
  // A range starting partway into the fade-in continues from that brightness.
  const late = await render(repository, project, "photo-late.mp4", {
    start: 0.15,
    end: 2,
  });
  const resumed = pixel(late, 0.15)[0];
  expect(resumed).toBeGreaterThan(Math.max(0, half[0] - 40));
  expect(resumed).toBeLessThan(half[0] + 40);
}, 30000);

async function crossfadeProject(
  repository: FileProjectRepository,
): Promise<Project> {
  const clip = await fixture(repository, "motion.mp4", {
    kind: "video",
    mime: "video/mp4",
    duration: 2,
    fps: 30,
    hasAudio: true,
  });
  let project = addAsset(createProject("Crossfade"), clip);
  project = {
    ...project,
    output: { ...project.output, encoder: "software" },
    scenes: [
      {
        ...createScene(clip),
        duration: 2,
        transition: "dissolve",
        transitionSeconds: 1,
      },
      { ...createScene(clip), duration: 2 },
    ],
  };
  return project;
}

it("keeps sound when an export range starts inside a transition", async () => {
  const repository = new FileProjectRepository(join(directory, "workspace"));
  const project = await crossfadeProject(repository);
  // The film is 3 s long and the dissolve covers 1 s to 2 s; start in its second half.
  const output = await render(repository, project, "range.mp4", {
    start: 1.6,
    end: 3,
  });
  const movie = inspectMovie(output);
  expect(movie.audio).toBe(true);
  expect(movie.duration).toBeCloseTo(1.4, 1);
}, 30000);

it("mixes music into an export range that starts inside a transition", async () => {
  const repository = new FileProjectRepository(join(directory, "workspace"));
  let project = await crossfadeProject(repository);
  const music = await fixture(repository, "music.mp3", {
    kind: "audio",
    mime: "audio/mpeg",
    duration: 3,
    width: 0,
    height: 0,
  });
  project = addAsset(project, music);
  project = {
    ...project,
    audioClips: [
      {
        id: "song",
        assetId: music.id,
        role: "music",
        start: 0,
        offset: 0,
        duration: 3,
        volume: 0.5,
        fadeIn: 0,
        fadeOut: 0,
        loop: false,
        followFilm: false,
      },
    ],
  };
  const output = await render(repository, project, "range-music.mp4", {
    start: 1.6,
    end: 3,
  });
  expect(inspectMovie(output).audio).toBe(true);
}, 30000);

it("shrinks an animated picture layer without leaving its earlier frames behind", async () => {
  const repository = new FileProjectRepository(join(directory, "workspace"));
  const red = await fixture(repository, "red.png");
  const blue = await fixture(repository, "blue.png");
  let project = addAsset(addAsset(createProject("Layer"), red), blue);
  const scene = createScene(red);
  project = {
    ...project,
    output: { ...project.output, encoder: "software" },
    scenes: [
      {
        ...scene,
        duration: 2,
        transition: "cut",
        layers: [
          mediaLayer(blue.id, { width: 0.8, height: 0.8, endScale: 0.25 }),
        ],
      },
    ],
  };
  const output = await render(repository, project, "layer.mp4");
  // At the start the blue layer covers most of the frame.
  expect(pixel(output, 0.05, 0.2, 0.5)[2]).toBeGreaterThan(200);
  // By the end it has shrunk to the centre; the area it left must be the red picture again.
  const left = pixel(output, 1.9, 0.2, 0.5);
  expect(left[0]).toBeGreaterThan(200);
  expect(left[2]).toBeLessThan(60);
  expect(pixel(output, 1.9, 0.5, 0.5)[2]).toBeGreaterThan(200);
}, 30000);

it("grows a rotated picture layer beyond its first frame's bounds", async () => {
  const repository = new FileProjectRepository(join(directory, "workspace"));
  const red = await fixture(repository, "red.png");
  const blue = await fixture(repository, "blue.png");
  let project = addAsset(addAsset(createProject("Grow"), red), blue);
  project = {
    ...project,
    output: { ...project.output, encoder: "software" },
    scenes: [
      {
        ...createScene(red),
        duration: 2,
        transition: "cut",
        layers: [
          mediaLayer(blue.id, {
            width: 0.3,
            height: 0.3,
            endScale: 2,
            rotation: 45,
          }),
        ],
      },
    ],
  };
  const output = await render(repository, project, "grow.mp4");
  // 0.7 across is outside the rotated layer's first-frame box but inside its final size.
  expect(pixel(output, 0.05, 0.7, 0.5)[0]).toBeGreaterThan(200);
  expect(pixel(output, 1.95, 0.7, 0.5)[2]).toBeGreaterThan(200);
}, 30000);

it.each([
  ["slide-left", [0.1, 0.5], [0.9, 0.5]],
  ["slide-right", [0.9, 0.5], [0.1, 0.5]],
  ["push-up", [0.5, 0.1], [0.5, 0.9]],
] as const)(
  "exports %s with the motion the preview layout draws",
  async (transition, outgoingPoint, incomingPoint) => {
    const repository = new FileProjectRepository(join(directory, "workspace"));
    const red = await fixture(repository, "red.png");
    const blue = await fixture(repository, "blue.png");
    let project = addAsset(addAsset(createProject("Motion"), red), blue);
    project = {
      ...project,
      output: { ...project.output, encoder: "software" },
      scenes: [
        { ...createScene(red), duration: 2, transition, transitionSeconds: 1 },
        { ...createScene(blue), duration: 2 },
      ],
    };
    const output = await render(repository, project, `${transition}.mp4`);
    // A quarter of the way through the 1 s overlap that starts at 1 s.
    const layout = transitionLayout(transition, 0.25, 1280, 720);
    const sideOf = (point: readonly [number, number]) =>
      point[0] * 1280 >= layout.incoming.dx &&
      point[0] * 1280 < layout.incoming.dx + 1280 &&
      point[1] * 720 >= layout.incoming.dy &&
      point[1] * 720 < layout.incoming.dy + 720
        ? "incoming"
        : "outgoing";
    expect(sideOf(outgoingPoint)).toBe("outgoing");
    expect(sideOf(incomingPoint)).toBe("incoming");
    expect(pixel(output, 1.25, ...outgoingPoint)[0]).toBeGreaterThan(200);
    expect(pixel(output, 1.25, ...incomingPoint)[2]).toBeGreaterThan(200);
  },
  30000,
);

it("exports a zoom transition that holds the outgoing picture through its first half", async () => {
  const repository = new FileProjectRepository(join(directory, "workspace"));
  const red = await fixture(repository, "red.png");
  const blue = await fixture(repository, "blue.png");
  let project = addAsset(addAsset(createProject("Zoom"), red), blue);
  project = {
    ...project,
    output: { ...project.output, encoder: "software" },
    scenes: [
      {
        ...createScene(red),
        duration: 2,
        transition: "zoom",
        transitionSeconds: 1,
      },
      { ...createScene(blue), duration: 2 },
    ],
  };
  const output = await render(repository, project, "zoom.mp4");
  expect(transitionLayout("zoom", 0.25, 1280, 720).outgoing.alpha).toBe(1);
  // Preview and export both show only the outgoing picture a quarter of the way in.
  const early = pixel(output, 1.25, 0.1, 0.5);
  expect(early[0]).toBeGreaterThan(200);
  expect(early[2]).toBeLessThan(40);
  // Three quarters in, both show a blend on the way to the incoming picture.
  const late = pixel(output, 1.75, 0.1, 0.5);
  expect(late[2]).toBeGreaterThan(40);
}, 30000);

function mediaLayer(
  assetId: string,
  values: Partial<VisualLayer>,
): VisualLayer {
  return visualLayerSchema.parse({
    id: "layer",
    kind: "media",
    assetId,
    x: 0.5,
    y: 0.5,
    fit: "cover",
    ...values,
  });
}
