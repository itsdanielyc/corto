import { copyFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { ExportProgress, MovieRequest } from "../contracts/platform";
import { EXPORT_FPS, FADE_SECONDS, parseProject } from "../contracts/project";
import { frameDimensions, sceneFrameCounts } from "../src/domain/timeline";
import type { FileProjectRepository } from "./storage";
import { writeAtomic } from "./atomic-file";
import { runFfmpeg } from "./ffmpeg-process";
import { sceneArguments } from "./movie-plan";

const MAX_OVERLAY_BYTES = 4 * 1024 ** 2;
const MAX_TOTAL_OVERLAY_BYTES = 32 * 1024 ** 2;
const TEMPORARY_PREFIX = "corto-render-";

/** Check cheap PNG headers and output dimensions before asking a decoder to process a title layer. */
function validateOverlay(png: Uint8Array, width: number, height: number): void {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    !(png instanceof Uint8Array) ||
    png.byteLength < 24 ||
    png.byteLength > MAX_OVERLAY_BYTES ||
    signature.some((value, index) => png[index] !== value)
  )
    throw new Error("A title image could not be read");
  const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
  if (header.getUint32(16) !== width || header.getUint32(20) !== height)
    throw new Error("A title image has the wrong movie dimensions");
}

/** An injected binary and repository keep actual video rendering testable outside Electron. */
export class MovieRenderer {
  constructor(
    private readonly binary: string,
    private readonly repository: FileProjectRepository,
  ) {}

  // Time O(encoded pixels + media bytes), space O(one scene's decoder/encoder buffers); scenes run sequentially.
  async render(
    request: MovieRequest,
    destination: string,
    signal: AbortSignal,
    progress: (value: ExportProgress) => void,
  ): Promise<void> {
    signal.throwIfAborted();
    const project = parseProject(request.project);
    if (!project.scenes.length)
      throw new Error("Add at least one scene before exporting");
    if (!["720p", "1080p"].includes(request.resolution))
      throw new Error("Choose HD or Full HD export quality");
    if (
      !Array.isArray(request.overlays) ||
      request.overlays.length > project.scenes.length
    )
      throw new Error("Invalid title layers");
    const dimensions = frameDimensions(project.ratio, request.resolution);
    const overlayMap = new Map<string, Uint8Array>();
    let overlayBytes = 0;
    for (const overlay of request.overlays) {
      if (
        !project.scenes.some(
          (scene) => scene.id === overlay.sceneId && scene.caption.trim(),
        ) ||
        overlayMap.has(overlay.sceneId)
      )
        throw new Error("A title layer does not match the film");
      validateOverlay(overlay.png, dimensions.width, dimensions.height);
      overlayBytes += overlay.png.byteLength;
      if (overlayBytes > MAX_TOTAL_OVERLAY_BYTES)
        throw new Error("The title layers exceed the movie memory budget");
      overlayMap.set(overlay.sceneId, overlay.png);
    }
    if (
      project.scenes.some(
        (scene) => scene.caption.trim() && !overlayMap.has(scene.id),
      )
    )
      throw new Error(
        "A title could not be rendered. Reopen the export window and try again.",
      );
    const directory = await mkdtemp(join(tmpdir(), TEMPORARY_PREFIX));
    const paths: string[] = [];
    const audioCache = new Map<string, boolean>();
    const frameCounts = sceneFrameCounts(project.scenes);
    const total =
      frameCounts.reduce((sum, count) => sum + count, 0) / EXPORT_FPS;
    let completed = 0;
    try {
      for (let index = 0; index < project.scenes.length; index++) {
        signal.throwIfAborted();
        const scene = {
          ...project.scenes[index],
          duration: frameCounts[index] / EXPORT_FPS,
        };
        const asset = scene.assetId ? project.assets[scene.assetId] : null;
        const source = asset ? this.repository.assetPath(asset.id) : null;
        if (asset && source && (await stat(source)).size !== asset.size)
          throw new Error(`Original media is incomplete: ${asset.name}`);
        let hasAudio = false;
        if (asset?.kind === "video" && scene.volume > 0 && source) {
          if (!audioCache.has(asset.id)) {
            const diagnostic = await runFfmpeg(
              this.binary,
              [
                "-loglevel",
                "info",
                "-protocol_whitelist",
                "file,pipe",
                "-i",
                source,
              ],
              { signal, allowFailure: true },
            );
            audioCache.set(asset.id, /Stream #.*Audio:/.test(diagnostic));
          }
          hasAudio = audioCache.get(asset.id)!;
        }
        const output = join(
          directory,
          `scene-${String(index).padStart(4, "0")}.mp4`,
        );
        const layer = overlayMap.get(scene.id);
        const overlay = layer ? join(directory, `title-${index}.png`) : null;
        if (overlay && layer) await writeFile(overlay, layer);
        const input = {
          scene,
          frames: frameCounts[index],
          asset,
          source,
          overlay,
          output,
          ...dimensions,
          hasAudio,
        };
        await runFfmpeg(this.binary, sceneArguments(input), {
          signal,
          onSeconds: (seconds) =>
            progress({
              fraction: Math.max(
                0,
                Math.min(
                  0.85,
                  ((completed + Math.min(scene.duration, seconds)) / total) *
                    0.85,
                ),
              ),
              message: `Rendering scene ${index + 1} of ${project.scenes.length}`,
            }),
        });
        paths.push(output);
        completed += scene.duration;
      }
      signal.throwIfAborted();
      progress({ fraction: 0.87, message: "Putting your story together" });
      const manifest = join(directory, "scenes.txt");
      await writeFile(
        manifest,
        paths.map((path) => `file '${basename(path)}'`).join("\n"),
      );
      const joined = join(directory, "joined.mp4");
      await runFfmpeg(
        this.binary,
        [
          "-f",
          "concat",
          "-safe",
          "1",
          "-protocol_whitelist",
          "file,pipe",
          "-i",
          manifest,
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          joined,
        ],
        { signal },
      );
      for (const path of paths) await rm(path);
      let finished = joined;
      if (project.music) {
        const soundtrack = this.repository.assetPath(project.music.assetId);
        const asset = project.assets[project.music.assetId];
        if ((await stat(soundtrack)).size !== asset.size)
          throw new Error("The soundtrack is missing or incomplete");
        const output = join(directory, "finished.mp4");
        const musicArguments = project.music.loop ? ["-stream_loop", "-1"] : [];
        const fade = Math.min(FADE_SECONDS, total / 2);
        const mix = `[1:a]volume=${project.music.volume},apad,atrim=duration=${total},afade=t=in:d=${fade},afade=t=out:st=${total - fade}:d=${fade}[music];[0:a][music]amix=inputs=2:duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.95:level=false[sound]`;
        progress({ fraction: 0.91, message: "Adding the soundtrack" });
        await runFfmpeg(
          this.binary,
          [
            "-i",
            joined,
            ...musicArguments,
            "-protocol_whitelist",
            "file,pipe",
            "-i",
            soundtrack,
            "-filter_complex",
            mix,
            "-map",
            "0:v:0",
            "-map",
            "[sound]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-t",
            String(total),
            "-movflags",
            "+faststart",
            output,
          ],
          { signal },
        );
        finished = output;
      }
      signal.throwIfAborted();
      progress({ fraction: 0.98, message: "Saving your movie" });
      await writeAtomic(destination, (temporary) =>
        copyFile(finished, temporary),
      );
      progress({ fraction: 1, message: "Your movie is ready" });
    } finally {
      const absolute = resolve(directory);
      const fromTemporaryRoot = relative(resolve(tmpdir()), absolute);
      if (
        !fromTemporaryRoot.startsWith("..") &&
        !fromTemporaryRoot.includes(":") &&
        basename(absolute).startsWith(TEMPORARY_PREFIX)
      )
        await rm(absolute, { recursive: true, force: true });
    }
  }
}
