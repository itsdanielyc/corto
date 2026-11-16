import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const binary = createRequire(import.meta.url)("ffmpeg-static");
const platform = `${process.platform}-${process.arch}`;
const manifest = JSON.parse(await readFile("package.json", "utf8"));
const hash = createHash("sha256");
for await (const chunk of createReadStream(binary)) hash.update(chunk);
const version = execFileSync(binary, ["-version"], {
  encoding: "utf8",
  windowsHide: true,
});
const sourceDirectory = join("release", "source-info", platform);
await mkdir(sourceDirectory, { recursive: true });
for (const file of await readdir(dirname(binary))) {
  if (file === "LICENSE" || /ffmpeg.*\.(README|LICENSE)$/.test(file))
    await copyFile(join(dirname(binary), file), join(sourceDirectory, file));
}
await writeFile(join(sourceDirectory, "version-and-build.txt"), version);
await copyFile(
  "scripts/ffmpeg-binaries.json",
  join(sourceDirectory, "upstream-checksums.json"),
);
await writeFile(
  join("release", `media-engine-${platform}.json`),
  JSON.stringify(
    {
      app: "Corto",
      appVersion: manifest.version,
      sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      platform,
      sha256: hash.digest("hex"),
      ffmpegVersion: version.split("\n")[0],
      distribution:
        "https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1",
    },
    null,
    2,
  ) + "\n",
);
