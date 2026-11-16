import { execFileSync, spawnSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";

/** Inspect the encoded file, independent of application state or the render command's exit code. */
export function inspectMovie(path: string): {
  duration: number;
  width: number;
  height: number;
  video: string;
  audio: boolean;
} {
  const result = spawnSync(ffmpeg!, ["-hide_banner", "-i", path], {
    encoding: "utf8",
    windowsHide: true,
  });
  const diagnostic = result.stderr ?? "";
  const duration = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(diagnostic);
  const video =
    diagnostic.split("\n").find((line) => line.includes("Video:")) ?? "";
  const size = /\b(\d{2,5})x(\d{2,5})\b/.exec(video);
  if (!duration || !size)
    throw new Error(
      `The exported movie has no readable video metadata: ${diagnostic}`,
    );
  return {
    duration:
      Number(duration[1]) * 3600 +
      Number(duration[2]) * 60 +
      Number(duration[3]),
    width: Number(size[1]),
    height: Number(size[2]),
    video,
    audio: diagnostic.includes("Audio:"),
  };
}

export function movieAudio(
  path: string,
  start: number,
  duration: number,
): Buffer {
  return execFileSync(
    ffmpeg!,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      String(start),
      "-t",
      String(duration),
      "-i",
      path,
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
}

/** Count bright title pixels in the central frame, independently verifying captions reached the movie. */
export function titlePixelFraction(path: string, time: number): number {
  const pixels = execFileSync(
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
      "crop=iw/2:ih/2:iw/4:ih/4,scale=320:180",
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
  let bright = 0;
  for (let offset = 0; offset < pixels.length; offset += 3)
    if (
      pixels[offset] > 160 &&
      pixels[offset + 1] > 160 &&
      pixels[offset + 2] > 160
    )
      bright++;
  return pixels.length ? bright / (pixels.length / 3) : 0;
}

// Time O(samples), space O(1); correlate against known fixture tones without depending on application mixing code.
export function toneMagnitude(pcm: Buffer, frequency: number): number {
  let sine = 0;
  let cosine = 0;
  const count = pcm.length / 2;
  for (let index = 0; index < count; index++) {
    const sample = pcm.readInt16LE(index * 2) / 32768;
    const phase = (2 * Math.PI * frequency * index) / 8000;
    sine += sample * Math.sin(phase);
    cosine += sample * Math.cos(phase);
  }
  return count ? Math.hypot(sine, cosine) / count : 0;
}
