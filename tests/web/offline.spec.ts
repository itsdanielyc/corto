import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readBundleIndex } from "../../contracts/bundle";

test("phone codecs and original-preserving portable projects work in the production build while offline", async ({
  page,
  context,
}, info) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page
    .getByTestId("media-input")
    .setInputFiles(join(process.cwd(), "tests/fixtures/phone.heic"));
  await expect(page.getByTestId("scene-card")).toHaveCount(1);
  await page
    .getByTestId("media-input")
    .setInputFiles({
      name: "phone-hdr.mp4",
      mimeType: "application/octet-stream",
      buffer: await readFile(
        join(process.cwd(), "tests/fixtures/phone-hdr.mp4"),
      ),
    });
  await expect(page.getByTestId("scene-card")).toHaveCount(2);
  await expect(page.getByTestId("preview-status")).toHaveText("Ready");
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Save portable copy" }).click();
  const path = info.outputPath("Phone-originals.corto");
  await (await download).saveAs(path);
  const bytes = new Uint8Array(await readFile(path));
  const index = await readBundleIndex({
    size: bytes.byteLength,
    read: async (start, end) => bytes.slice(start, end),
  });
  expect(index.assets.filter(({ asset }) => asset.isOriginalOnly)).toHaveLength(
    2,
  );
  for (const { asset, offset } of index.assets.filter(
    ({ asset }) => asset.isOriginalOnly,
  )) {
    expect(bytes.slice(offset, offset + asset.size)).toEqual(
      new Uint8Array(
        await readFile(join(process.cwd(), "tests/fixtures", asset.name)),
      ),
    );
  }
});

test("the production web app caches its shell and preserves portable projects entirely offline", async ({
  page,
  context,
}, info) => {
  page.on("requestfailed", (request) =>
    console.log("Offline request failed:", request.url(), request.failure()),
  );
  page.on("pageerror", (error) =>
    console.log("Offline page error:", error.message),
  );
  await page.goto("/");
  await expect(page.getByTestId("editor-shell")).toHaveAttribute(
    "data-backend",
    "web",
  );
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("editor-shell")).toHaveAttribute(
    "data-backend",
    "web",
  );
  await page.getByRole("button", { name: "Try an example" }).click();
  await expect(page.getByTestId("scene-card")).toHaveCount(4);
  await expect(page.getByTestId("preview-status")).toHaveText("Ready");
  await expect(page.getByTestId("save-status")).toHaveText(
    "Saved on this device",
  );
  expect(await page.getByRole("alert").count()).toBe(0);
  await page.getByRole("button", { name: "Project actions" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Save portable copy" }).click();
  const copy = await download;
  const path = info.outputPath("Offline.corto");
  await copy.saveAs(path);
  expect((await readFile(path)).subarray(0, 8).toString()).toBe("CORTO001");
});
