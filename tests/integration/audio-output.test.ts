import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { FileProjectRepository } from "../../electron/storage";
import { MovieRenderer } from "../../electron/movie-renderer";
import { createProject, createScene, addAsset } from "../../src/domain/project";
import { addMusic } from "../../src/domain/audio";
import type { MediaAsset } from "../../contracts/project";
import { movieAudio, toneMagnitude } from "../helpers/movie-inspection";

it("exports real WAV and M4A sound without decoding missing pictures", async () => {
  const directory = await mkdtemp(join(tmpdir(), "corto-audio-output-"));
  try {
    const repository = new FileProjectRepository(join(directory, "workspace"));
    let project = createProject("Sound only");
    const photo: MediaAsset = {
      id: "missing-photo",
      name: "Missing picture.png",
      mime: "image/png",
      kind: "image",
      width: 160,
      height: 90,
      duration: 0,
      size: 12,
    };
    project = addAsset(project, photo);
    const assets: MediaAsset[] = [];
    for (const [file, kind, duration, mime] of [
      ["motion.mp4", "video", 2, "video/mp4"],
      ["music.mp3", "audio", 3, "audio/mpeg"],
    ] as const) {
      const path = join(process.cwd(), "tests/fixtures", file);
      const asset: MediaAsset = {
        id: file.replace(".", "-"),
        name: file,
        kind,
        mime,
        duration,
        size: (await stat(path)).size,
        width: kind === "video" ? 160 : 0,
        height: kind === "video" ? 90 : 0,
      };
      await repository.putAsset(asset, path);
      assets.push(asset);
      project = addAsset(project, asset);
    }
    project = {
      ...project,
      scenes: [
        { ...createScene(photo), duration: 0.5 },
        { ...createScene(assets[0]), start: 0.25, duration: 0.5 },
      ],
    };
    project = addMusic(project, assets[1]);
    for (const format of ["wav", "m4a"] as const) {
      const output = join(directory, `sound.${format}`);
      await new MovieRenderer(ffmpeg!, repository).render(
        {
          project: { ...project, output: { ...project.output, format } },
          resolution: "720p",
          overlays: [],
        },
        output,
        new AbortController().signal,
        () => undefined,
      );
      const diagnostic = spawnSync(ffmpeg!, ["-hide_banner", "-i", output], {
        encoding: "utf8",
        windowsHide: true,
      }).stderr;
      expect(diagnostic).toContain("Audio:");
      expect(diagnostic).not.toContain("Video:");
      expect(
        (await readFile(output))
          .subarray(format === "wav" ? 0 : 4, format === "wav" ? 4 : 8)
          .toString(),
      ).toBe(format === "wav" ? "RIFF" : "ftyp");
      const pcm = movieAudio(output, 0.65, 0.2);
      expect(toneMagnitude(pcm, 440)).toBeGreaterThan(0.005);
      expect(toneMagnitude(pcm, 880)).toBeGreaterThan(0.003);
    }
  } finally {
    if (basename(directory).startsWith("corto-audio-output-"))
      await rm(directory, { recursive: true, force: true });
  }
}, 30000);
