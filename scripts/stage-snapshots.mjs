import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const source = resolve("tests/ui/__snapshots__");
const destination = resolve("artifacts/snapshots-staged");

/** Upload only this runner's pixels; Linux owns the shared structure/geometry files. */
async function stage(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await stage(path);
      continue;
    }
    if (!entry.isFile()) continue;
    const ownPixels = entry.name.endsWith(`-${process.platform}.png`);
    const shared = process.platform === "linux" && !entry.name.endsWith(".png");
    if (!ownPixels && !shared) continue;
    const target = join(destination, relative(source, path));
    await mkdir(dirname(target), { recursive: true });
    await copyFile(path, target);
  }
}

await stage(source);
