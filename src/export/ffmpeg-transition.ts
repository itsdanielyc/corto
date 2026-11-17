import type { RenderSegment } from "../domain/render-plan";
import type { Encoder } from "./ffmpeg-types";
import { encoderArguments } from "./encoder-settings";
const TRANSITIONS: Readonly<Record<string, string>> = {
  dissolve: "fade",
  "fade-white": "fadewhite",
  "wipe-left": "wipeleft",
  "wipe-right": "wiperight",
  "slide-left": "slideleft",
  "slide-right": "slideright",
  "push-up": "slideup",
  zoom: "zoomin",
  blur: "hblur",
};

/** Adjacent overlaps share an integer frame budget and the same audio crossfade on both encoders. */
export function transitionArguments(input: {
  from: string;
  to: string;
  output: string;
  segment: RenderSegment;
  fps: number;
  encoder: Encoder;
  bitrate: number;
  audioOnly: boolean;
}): string[] {
  const { segment, fps } = input;
  const duration = segment.frames / fps;
  // A streaming linear crossfade. acrossfade holds back all of its output until
  // both inputs end, so `-frames:v` closed a trimmed part before any audio arrived.
  const audio = `[0:a]afade=t=out:st=0:d=${segment.fullDuration}:curve=tri[outgoing];[1:a]afade=t=in:st=0:d=${segment.fullDuration}:curve=tri[incoming];[outgoing][incoming]amix=inputs=2:duration=longest:normalize=0,atrim=start=${segment.trimStart}:duration=${duration},asetpts=PTS-STARTPTS[sound]`;
  const picture = `[0:v]setpts=PTS-STARTPTS,fps=${fps}[a];[1:v]setpts=PTS-STARTPTS,fps=${fps}[b];[a][b]xfade=transition=${TRANSITIONS[segment.from.scene.transition] ?? "fade"}:duration=${segment.fullDuration}:offset=0,trim=start=${segment.trimStart}:duration=${duration},setpts=PTS-STARTPTS[picture]`;
  return [
    "-i",
    input.from,
    "-i",
    input.to,
    "-filter_complex_threads",
    "1",
    "-filter_complex",
    input.audioOnly ? audio : `${picture};${audio}`,
    ...(input.audioOnly
      ? ["-vn"]
      : [
          "-map",
          "[picture]",
          ...encoderArguments(input.encoder, input.bitrate),
          "-r",
          String(fps),
          "-frames:v",
          String(segment.frames),
        ]),
    "-map",
    "[sound]",
    "-c:a",
    input.audioOnly ? "pcm_s16le" : "aac",
    ...(input.audioOnly ? [] : ["-b:a", "192k"]),
    "-t",
    String(duration),
    input.output,
  ];
}
