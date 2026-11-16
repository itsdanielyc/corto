import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { collectCodecSources } from "./collect-codec-sources.mjs";

const root = "publish";
const manifest = JSON.parse(await readFile("package.json", "utf8"));
const files = await readdir(root);
const information = join(root, "source-info");
await mkdir(information, { recursive: true });
const versions = new Set();
for (const file of files.filter((name) =>
  /^media-engine-.*\.json$/.test(name),
)) {
  const engine = JSON.parse(await readFile(join(root, file), "utf8"));
  const version = /^ffmpeg version (\d+\.\d+(?:\.\d+)?)/.exec(
    engine.ffmpegVersion,
  )?.[1];
  if (!version)
    throw new Error(`Unknown FFmpeg source version: ${engine.ffmpegVersion}`);
  versions.add(version);
  await copyFile(join(root, file), join(information, file));
}
if (versions.size === 0)
  throw new Error("No media-engine provenance was downloaded");
versions.add("5.1.4");
for (const version of versions) {
  const url = `https://ffmpeg.org/releases/ffmpeg-${version}.tar.xz`;
  const response = await fetch(url);
  if (!response.ok || !response.body)
    throw new Error(`Could not download core FFmpeg source: ${url}`);
  await pipeline(
    Readable.fromWeb(response.body),
    createWriteStream(join(information, `ffmpeg-${version}.tar.xz`)),
  );
}
await collectCodecSources(information);
await copyFile(
  "THIRD_PARTY_NOTICES.md",
  join(information, "THIRD_PARTY_NOTICES.md"),
);
await writeFile(
  join(information, "README.txt"),
  "Core FFmpeg source archives for the bundled versions, unmodified distributor licenses/readmes/build information, and exact binary provenance. Optional libraries retain their own licenses and source locations in the distributor build information. Corto application source is available in this release's GitHub source archives.\n",
);
execFileSync(
  "zip",
  [
    "-q",
    "-r",
    `Corto-${manifest.version}-media-source-info.zip`,
    "source-info",
  ],
  { cwd: root },
);
const bundles = (await readdir(root))
  .filter((name) => /\.(exe|dmg|deb|AppImage|zip)$/.test(name))
  .sort();
if (
  !bundles.some((name) => name.endsWith(".exe")) ||
  !bundles.some((name) => name.endsWith(".dmg")) ||
  !bundles.some((name) => name.endsWith(".deb")) ||
  !bundles.some((name) => name.endsWith(".AppImage"))
)
  throw new Error("A platform bundle is missing");
const sums = [];
for (const file of bundles) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(join(root, file)))
    hash.update(chunk);
  sums.push(`${hash.digest("hex")}  ${file}`);
}
await writeFile(join(root, "SHA256SUMS.txt"), sums.join("\n") + "\n");
const changelog = await readFile("CHANGELOG.md", "utf8");
const section = changelog
  .split(`## [${manifest.version}]`)[1]
  ?.split("\n## ")[0]
  ?.trim();
if (!section) throw new Error("The release has no changelog section");
await writeFile(
  "release-notes.md",
  `${section}\n\n### Installation and signing\n\nUnsigned preview installers for Windows x64, Apple Silicon/Intel macOS and Linux x64. Windows can show \"Windows protected your PC\"; macOS can report an unidentified developer or that Apple cannot check the app. Read [installation instructions](https://github.com/${process.env.GITHUB_REPOSITORY}/blob/${process.env.GITHUB_REF_NAME}/docs/installing.md). Signing/notarization is not configured; it requires the operator's signing credentials and, for Apple Developer ID, a paid annual membership.\n\nThe web archive is a static offline-capable build. Personal media stays local. Core media-engine source archives, producer licenses/build information and SHA-256 checksums are attached.\n\nInstaller pre-tag gate: ${process.env.INSTALLER_GATE_URL}\n`,
);
console.log(`Prepared ${bundles.length} release artifacts with checksums`);
