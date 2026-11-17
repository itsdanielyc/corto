import { expect, it } from "vitest";
import { readFile, stat } from "node:fs/promises";
import { crc32 } from "node:zlib";
import { RenderAssets } from "../../electron/render-assets";
import { createProject, createScene } from "../../src/domain/project";
import { textItemSchema } from "../../contracts/creative";

it("stages more than the former 32 MB aggregate limit incrementally and binds assets to an immutable project", async () => {
  const cache = new RenderAssets();
  const picture = await readFile("tests/fixtures/red.png");
  const payload = Buffer.alloc(1024 * 1024, 65);
  payload[4] = 0;
  const type = Buffer.from("tEXt");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, payload])));
  const png = new Uint8Array(
    Buffer.concat([
      picture.subarray(0, 33),
      length,
      type,
      payload,
      crc,
      picture.subarray(33),
    ]),
  );
  const project = {
    ...createProject("Long tribute"),
    scenes: Array.from({ length: 2 }, () => ({
      ...createScene(null),
      caption: "",
      textItems: Array.from({ length: 20 }, () =>
        textItemSchema.parse({
          id: crypto.randomUUID(),
          text: "Every moment matters",
        }),
      ),
    })),
  };
  const token = await cache.begin(project, "720p");
  let path = "";
  try {
    await expect(
      cache.stage(token, { key: "text:foreign", width: 160, height: 90, png }),
    ).rejects.toThrow("does not belong");
    for (const scene of project.scenes)
      for (const item of scene.textItems)
        await cache.stage(token, {
          key: `text:${scene.id}:${item.id}`,
          width: 160,
          height: 90,
          png,
        });
    const layers = cache.resolve(token, project, "720p");
    expect(layers.size).toBe(40);
    path = layers.values().next().value!.path;
    expect((await stat(path)).size).toBeGreaterThan(1024 * 1024);
    expect(() =>
      cache.resolve(
        token,
        { ...project, name: "Changed during export" },
        "720p",
      ),
    ).toThrow("immutable");
  } finally {
    await cache.release(token);
  }
  await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
});
