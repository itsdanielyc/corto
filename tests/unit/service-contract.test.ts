import { expect, it } from "vitest";
import { mediaOperationSchema } from "../../contracts/services";
import { preferencesSchema } from "../../contracts/creative";

it("restricts local media jobs to finite, project-owned operations", () => {
  expect(mediaOperationSchema.parse({ assetId: "clip", operation: "frame", start: 1 })).toMatchObject({ threshold: 0.3, start: 1 });
  for (const input of [
    { assetId: "../private", operation: "audio" },
    { assetId: "clip", operation: "exec" },
    { assetId: "clip", operation: "frame", start: Infinity },
    { assetId: "clip", operation: "reverse", source: "C:/private" },
    { assetId: "clip", operation: "audio", speed: 0 },
  ]) expect(() => mediaOperationSchema.parse(input)).toThrow();
});

it("supplies output defaults for existing preferences without a format migration", () => {
  expect(preferencesSchema.parse({}).output).toMatchObject({ resolution: "1080p", fps: 30, format: "mp4" });
});
