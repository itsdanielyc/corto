import { createWriteStream } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/** Retain the exact upstream codec/build sources with the existing release source-information bundle. */
export async function collectCodecSources(destination) {
  const manifestPath = "public/licenses/codec-sources.json";
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  await copyFile(manifestPath, join(destination, "browser-codec-sources.json"));
  for (const codec of manifest.codecs) {
    for (const source of codec.sources) {
      const response = await fetch(source.url);
      if (!response.ok || !response.body)
        throw new Error(`Could not download codec source: ${source.name}`);
      await pipeline(
        Readable.fromWeb(response.body),
        createWriteStream(
          join(destination, `${source.name}-${codec.version}.tar.gz`),
        ),
      );
    }
  }
}
