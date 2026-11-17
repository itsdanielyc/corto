import { afterEach, expect, it, vi } from "vitest";
import { checkPublishedUpdate } from "../../src/platform/updates";
afterEach(() => vi.unstubAllGlobals());
it("finds published preview updates for 0.x while retaining stable-only checks for established releases", async () => {
  const release = {
    tag_name: "v0.1.2",
    html_url: "https://github.com/itsdanielyc/corto/releases/tag/v0.1.2",
    draft: false,
    prerelease: true,
  };
  const read = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify([release]), { status: 200 }),
    );
  vi.stubGlobal("fetch", read);
  expect(await checkPublishedUpdate("0.1.1")).toMatchObject({
    version: "0.1.2",
    signed: false,
  });
  expect(read.mock.calls[0][0]).toContain("releases?per_page=20");
  read.mockResolvedValue(
    new Response(
      JSON.stringify({
        ...release,
        tag_name: "v2.0.0",
        html_url: "https://github.com/itsdanielyc/corto/releases/tag/v2.0.0",
      }),
      { status: 200 },
    ),
  );
  await expect(checkPublishedUpdate("1.0.0")).rejects.toThrow("channel");
});
it("rejects foreign download links and returns no update for an equal version", async () => {
  const release = {
    tag_name: "v0.1.2",
    html_url: "https://github.com/itsdanielyc/corto/releases/tag/v0.1.2",
    draft: false,
    prerelease: true,
  };
  const read = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify([release]), { status: 200 }),
    );
  vi.stubGlobal("fetch", read);
  expect(await checkPublishedUpdate("0.1.2")).toBeNull();
  read.mockResolvedValue(
    new Response(
      JSON.stringify([
        { ...release, html_url: "https://elsewhere.example/download" },
      ]),
      { status: 200 },
    ),
  );
  await expect(checkPublishedUpdate("0.1.1")).rejects.toThrow("channel");
});
