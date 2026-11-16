// @ts-check
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const manifest = JSON.parse(
  await readFile(new URL("./ffmpeg-binaries.json", import.meta.url), "utf8"),
);
const platform = `${process.platform}-${process.arch}`;
const expected = manifest.sha256[platform];
if (!expected)
  throw new Error(
    `No verified media engine is configured for ${platform}. See the platform support ADR.`,
  );
const binary = createRequire(import.meta.url)("ffmpeg-static");
if (typeof binary !== "string")
  throw new Error(`FFmpeg is unavailable for ${platform}`);
const hash = createHash("sha256");
for await (const chunk of createReadStream(binary)) hash.update(chunk);
const actual = hash.digest("hex");
if (actual !== expected)
  throw new Error(
    `FFmpeg integrity check failed for ${platform}. Expected ${expected}, received ${actual}.`,
  );
console.log(`Verified FFmpeg (${platform}, SHA-256 ${actual.slice(0, 16)}…)`);
console.log(
  execFileSync(binary, ["-version"], {
    encoding: "utf8",
    windowsHide: true,
  }).split("\n")[0],
);
