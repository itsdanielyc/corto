import { randomUUID } from "node:crypto";
import { mkdtemp, stat, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import type { ImportedMedia } from "../contracts/platform";
import { LIMITS, type MediaAsset } from "../contracts/project";
import { phoneVideoArguments } from "../src/media/phone-plan";
import { runFfmpeg } from "./ffmpeg-process";
import type { FileProjectRepository } from "./storage";

/** A separate native process converts a selected phone original; large videos never cross IPC as buffers. */
export async function importPhoneVideo(
  binary: string,
  repository: FileProjectRepository,
  source: string,
  name: string,
): Promise<ImportedMedia> {
  const originalSize = (await stat(source)).size;
  if (
    !/\.(mp4|mov|m4v)$/i.test(name) ||
    originalSize <= 0 ||
    originalSize > LIMITS.assetBytes
  )
    throw new Error(
      "Choose a complete phone video within the 2 GB import limit",
    );
  const directory = await mkdtemp(join(tmpdir(), "corto-phone-"));
  const signal = AbortSignal.timeout(30 * 60 * 1000);
  try {
    const diagnostic = await runFfmpeg(
      binary,
      ["-loglevel", "info", "-protocol_whitelist", "file,pipe", "-i", source],
      { signal, allowFailure: true },
    );
    const output = join(directory, "compatible.mp4");
    await runFfmpeg(
      binary,
      phoneVideoArguments(
        source,
        output,
        /bt2020|smpte2084|arib-std-b67/.test(diagnostic),
      ),
      { signal },
    );
    const metadata = await runFfmpeg(
      binary,
      ["-loglevel", "info", "-i", output],
      { signal, allowFailure: true },
    );
    const dimensions = /Video:.*?\b(\d{2,5})x(\d{2,5})\b/.exec(metadata);
    const duration = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(metadata);
    if (!dimensions || !duration)
      throw new Error(
        "The converted phone video has no playable picture or duration",
      );
    const original: MediaAsset = {
      id: randomUUID(),
      name,
      kind: "video",
      mime: /\.mov$/i.test(name) ? "video/quicktime" : "video/mp4",
      size: originalSize,
      duration:
        Number(duration[1]) * 3600 +
        Number(duration[2]) * 60 +
        Number(duration[3]),
      width: Number(dimensions[1]),
      height: Number(dimensions[2]),
      isOriginalOnly: true,
    };
    const asset: MediaAsset = {
      ...original,
      id: randomUUID(),
      mime: "video/mp4",
      size: (await stat(output)).size,
      isOriginalOnly: false,
      originalAssetId: original.id,
    };
    await repository.putAsset(original, source);
    await repository.putAsset(asset, output);
    return { asset, original };
  } finally {
    if (basename(directory).startsWith("corto-phone-"))
      await rm(directory, { recursive: true, force: true });
  }
}
