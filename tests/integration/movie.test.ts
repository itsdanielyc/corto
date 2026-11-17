import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { MovieRenderer } from "../../electron/movie-renderer";
import { FileProjectRepository } from "../../electron/storage";
import {
  addAsset,
  appendScene,
  changeScene,
  createProject,
  createScene,
} from "../../src/domain/project";
import type { MediaAsset, Project } from "../../contracts/project";
import { addMusic } from "../../src/domain/audio";
import { inspectMovie } from "../helpers/movie-inspection";

let directory: string;
let repository: FileProjectRepository;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "corto-movie-test-"));
  repository = new FileProjectRepository(join(directory, "workspace"));
});
afterEach(async () => {
  if (basename(directory).startsWith("corto-movie-test-"))
    await rm(directory, { recursive: true, force: true });
});

async function original(
  name: string,
  kind: MediaAsset["kind"],
  mime: string,
  duration: number,
): Promise<MediaAsset> {
  const path = join(process.cwd(), "tests", "fixtures", name);
  const asset: MediaAsset = {
    id: name.replace(/\./g, "-"),
    name,
    kind,
    mime,
    size: (await stat(path)).size,
    duration,
    width: kind === "audio" ? 0 : 160,
    height: kind === "audio" ? 0 : 90,
  };
  await repository.putAsset(asset, path);
  return asset;
}

async function film(): Promise<Project> {
  const photo = await original("red.png", "image", "image/png", 0);
  const video = await original("motion.mp4", "video", "video/mp4", 2);
  const music = await original("music.mp3", "audio", "audio/mpeg", 3);
  let project = addAsset(
    addAsset(addAsset(createProject("Test film"), photo), video),
    music,
  );
  project = appendScene(project, { ...createScene(photo), duration: 0.5 });
  project = appendScene(project, {
    ...createScene(video),
    start: 0.25,
    duration: 0.75,
  });
  project = appendScene(project, {
    ...createScene(null),
    caption: "",
    background: "#0011ee",
    duration: 0.5,
  });
  return addMusic(project, music);
}

function pixel(path: string, time: number): Buffer {
  return execFileSync(
    ffmpeg!,
    [
      "-hide_banner",
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
    { maxBuffer: 1024 * 1024, windowsHide: true },
  );
}

// Time O(samples), space O(1); correlation proves each independent tone survived the audio mix.
function toneMagnitude(pcm: Buffer, frequency: number): number {
  let sine = 0;
  let cosine = 0;
  const sampleRate = 8000;
  const samples = pcm.length / 2;
  for (let index = 0; index < samples; index++) {
    const value = pcm.readInt16LE(index * 2) / 32768;
    const phase = (2 * Math.PI * frequency * index) / sampleRate;
    sine += value * Math.sin(phase);
    cosine += value * Math.cos(phase);
  }
  return Math.hypot(sine, cosine) / samples;
}

describe("real native movies", () => {
  it("encodes a playable MP4 with ordered frames, correct dimensions, source audio and music", async () => {
    const project = await film();
    const output = join(directory, "Family movie.mp4");
    const fractions: number[] = [];
    await new MovieRenderer(ffmpeg!, repository).render(
      { project, resolution: "720p", overlays: [] },
      output,
      new AbortController().signal,
      (value) => fractions.push(value.fraction),
    );
    expect((await stat(output)).size).toBeGreaterThan(1000);
    const properties = inspectMovie(output);
    expect(properties.duration).toBeGreaterThan(1.65);
    expect(properties.duration).toBeLessThan(1.9);
    expect(properties).toMatchObject({ width: 1280, height: 720, audio: true });
    expect(properties.video).toContain("h264");
    const diagnostic = execFileSync(
      ffmpeg!,
      ["-hide_banner", "-i", output, "-f", "null", "-"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    expect(diagnostic).toBe("");
    const first = pixel(output, 0.25);
    const last = pixel(output, 1.5);
    expect(first[0]).toBeGreaterThan(200);
    expect(first[2]).toBeLessThan(60);
    expect(last[2]).toBeGreaterThan(200);
    expect(last[0]).toBeLessThan(60);
    const metadata = execFileSync(
      ffmpeg!,
      [
        "-hide_banner",
        "-loglevel",
        "info",
        "-i",
        output,
        "-frames:v",
        "1",
        "-f",
        "null",
        "-",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    expect(metadata).toBe("");
    const pcm = execFileSync(
      ffmpeg!,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        "0.7",
        "-t",
        "0.3",
        "-i",
        output,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "8000",
        "-f",
        "s16le",
        "pipe:1",
      ],
      { maxBuffer: 1024 * 1024, windowsHide: true },
    );
    expect(toneMagnitude(pcm, 440)).toBeGreaterThan(0.01);
    expect(toneMagnitude(pcm, 880)).toBeGreaterThan(0.005);
    const raw = execFileSync(
      ffmpeg!,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        "0.1",
        "-i",
        output,
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "pipe:1",
      ],
      { maxBuffer: 4 * 1024 ** 2, windowsHide: true },
    );
    expect(raw.length).toBe(1280 * 720 * 3);
    expect(fractions.at(-1)).toBe(1);
    expect(fractions.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("produces a square silent movie without needing a soundtrack", async () => {
    const photo = await original("blue.png", "image", "image/png", 0);
    const project = appendScene(
      addAsset({ ...createProject(), ratio: "square" }, photo),
      { ...createScene(photo), duration: 0.5 },
    );
    const output = join(directory, "Square.mp4");
    await new MovieRenderer(ffmpeg!, repository).render(
      { project, resolution: "720p", overlays: [] },
      output,
      new AbortController().signal,
      () => undefined,
    );
    const frame = execFileSync(
      ffmpeg!,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        output,
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "pipe:1",
      ],
      { maxBuffer: 4 * 1024 ** 2, windowsHide: true },
    );
    expect(frame.length).toBe(720 * 720 * 3);
    expect(frame[2]).toBeGreaterThan(200);
  });

  it("cancels a running encoder, cleans its temporary directory and preserves an existing destination", async () => {
    const photo = await original("red.png", "image", "image/png", 0);
    let project = appendScene(
      addAsset(createProject(), photo),
      createScene(photo),
    );
    project = changeScene(project, project.scenes[0].id, { duration: 120 });
    const output = join(directory, "Keep.mp4");
    await writeFile(output, "previous movie");
    const before = new Set(
      (await readdir(tmpdir())).filter((name) =>
        name.startsWith("corto-render-"),
      ),
    );
    const controller = new AbortController();
    await expect(
      new MovieRenderer(ffmpeg!, repository).render(
        { project, resolution: "720p", overlays: [] },
        output,
        controller.signal,
        () => controller.abort(),
      ),
    ).rejects.toThrow(/abort|cancel/i);
    expect(await readFile(output, "utf8")).toBe("previous movie");
    expect(
      (await readdir(tmpdir())).filter(
        (name) => name.startsWith("corto-render-") && !before.has(name),
      ),
    ).toEqual([]);
  });
});
