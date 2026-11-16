import {
  EXPORT_FPS,
  FADE_SECONDS,
  type MediaAsset,
  type Scene,
} from "../contracts/project";

const FRAME_RATE = String(EXPORT_FPS);
const AUDIO_SAMPLE_RATE = "48000";
const ENCODER_THREADS = "2";
const imageDecoders: Readonly<Record<string, string>> = {
  "image/jpeg": "mjpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/gif": "gif",
};

export interface SceneRenderInput {
  scene: Scene;
  frames: number;
  asset: MediaAsset | null;
  source: string | null;
  overlay: string | null;
  output: string;
  width: number;
  height: number;
  hasAudio: boolean;
  videoBitrate?: number;
}

/** Translate validated edits into safe FFmpeg arguments. Captions are PNGs, never filter-language text. */
export function sceneArguments(input: SceneRenderInput): string[] {
  const { scene, asset, source, overlay, output, width, height, hasAudio } =
    input;
  const arguments_: string[] = [];
  if (asset?.kind === "image" && source)
    arguments_.push(
      "-f",
      "image2",
      "-pattern_type",
      "none",
      "-loop",
      "1",
      "-framerate",
      FRAME_RATE,
      "-c:v",
      imageDecoders[asset.mime],
      "-protocol_whitelist",
      "file,pipe",
      "-i",
      source,
    );
  else if (asset?.kind === "video" && source)
    arguments_.push(
      "-ss",
      String(scene.start),
      "-protocol_whitelist",
      "file,pipe",
      "-i",
      source,
    );
  else
    arguments_.push(
      "-f",
      "lavfi",
      "-i",
      `color=c=0x${scene.background.slice(1)}:s=${width}x${height}:r=${FRAME_RATE}:d=${scene.duration}`,
    );
  arguments_.push(
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=${AUDIO_SAMPLE_RATE}:cl=stereo`,
  );
  if (overlay)
    arguments_.push("-loop", "1", "-framerate", FRAME_RATE, "-i", overlay);
  const scale =
    scene.fit === "cover"
      ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
      : `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x${scene.background.slice(1)}`;
  const filters = [`[0:v]${scale},setsar=1[base]`];
  if (overlay) filters.push("[base][2:v]overlay=0:0:shortest=1[captioned]");
  const fade = Math.min(FADE_SECONDS, scene.duration / 2);
  const fadeFilters =
    scene.transition === "fade"
      ? `fade=t=in:d=${fade},fade=t=out:st=${scene.duration - fade}:d=${fade},`
      : "";
  filters.push(
    `[${overlay ? "captioned" : "base"}]tpad=stop_mode=clone:stop_duration=${1 / EXPORT_FPS},${fadeFilters}format=yuv420p[picture]`,
  );
  const audioFilters = [
    `volume=${hasAudio ? scene.volume : 0}`,
    "apad",
    `atrim=duration=${scene.duration}`,
  ];
  if (scene.transition === "fade")
    audioFilters.push(
      `afade=t=in:d=${fade}`,
      `afade=t=out:st=${scene.duration - fade}:d=${fade}`,
    );
  arguments_.push(
    "-filter_complex_threads",
    "1",
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[picture]",
    "-map",
    hasAudio ? "0:a:0" : "1:a:0",
    "-af",
    audioFilters.join(","),
    "-t",
    String(scene.duration),
    "-frames:v",
    String(input.frames),
    "-r",
    FRAME_RATE,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    ...(input.videoBitrate
      ? [
          "-b:v",
          String(input.videoBitrate),
          "-maxrate",
          String(Math.round(input.videoBitrate * 1.5)),
          "-bufsize",
          String(input.videoBitrate * 2),
        ]
      : ["-crf", "20"]),
    "-threads",
    ENCODER_THREADS,
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ar",
    AUDIO_SAMPLE_RATE,
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    output,
  );
  return arguments_;
}
