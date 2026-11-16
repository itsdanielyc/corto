import { describe, expect, it } from "vitest";
import { encodeBundleHeader, readBundleIndex } from "../../contracts/bundle";
import { addAsset, createProject } from "../../src/domain/project";

const project = addAsset(createProject("A portable film"), {
  id: "photo-1",
  name: "Family.jpg",
  kind: "image",
  mime: "image/jpeg",
  size: 3,
  duration: 0,
  width: 10,
  height: 10,
});

function reader(bytes: Uint8Array) {
  return {
    size: bytes.length,
    read: async (start: number, end: number) => bytes.slice(start, end),
  };
}

describe("streamable portable projects", () => {
  it("indexes original media without loading it into memory", async () => {
    const header = encodeBundleHeader(project);
    const bytes = new Uint8Array([...header, 1, 2, 3]);
    const index = await readBundleIndex(reader(bytes));
    expect(index.project.name).toBe("A portable film");
    expect(index.assets).toEqual([
      { asset: project.assets["photo-1"], offset: header.length },
    ]);
  });

  it("rejects unknown signatures, truncated media and trailing payloads", async () => {
    const header = encodeBundleHeader(project);
    await expect(readBundleIndex(reader(new Uint8Array(16)))).rejects.toThrow(
      /Corto/i,
    );
    await expect(readBundleIndex(reader(header))).rejects.toThrow(
      /incomplete/i,
    );
    await expect(
      readBundleIndex(reader(new Uint8Array([...header, 1, 2, 3, 4]))),
    ).rejects.toThrow(/length/i);
  });

  it("rejects oversized headers before allocating or parsing them", async () => {
    const header = encodeBundleHeader(project);
    new DataView(header.buffer).setUint32(8, 0xffffffff, true);
    let reads = 0;
    const hostileReader = {
      size: 0xffffffff + 12,
      read: async (start: number, end: number) => {
        reads++;
        return header.slice(start, end);
      },
    };
    await expect(readBundleIndex(hostileReader)).rejects.toThrow(/manifest/i);
    expect(reads).toBe(1);
  });
});
