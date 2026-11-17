import type { Encoder } from "./ffmpeg-types";

export function encoderArguments(encoder: Encoder, bitrate?: number): string[] {
  return [
    "-c:v",
    encoder.name,
    ...(encoder.name === "libx264"
      ? [
          "-preset",
          "veryfast",
          "-crf",
          String(Math.round(35 - encoder.quality * 0.25)),
        ]
      : []),
    ...(bitrate
      ? [
          "-b:v",
          String(bitrate),
          "-maxrate",
          String(Math.round(bitrate * 1.5)),
          "-bufsize",
          String(bitrate * 2),
        ]
      : encoder.name !== "libx264"
        ? ["-b:v", "8000000"]
        : []),
    "-threads",
    String(encoder.threads),
    "-pix_fmt",
    "yuv420p",
  ];
}
