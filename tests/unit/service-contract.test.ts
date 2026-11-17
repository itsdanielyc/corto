import { expect, it } from "vitest";
import { mediaOperationSchema } from "../../contracts/services";

it("restricts local media jobs to finite, project-owned operations", () => {
  expect(mediaOperationSchema.parse({ assetId: "clip", operation: "frame", start: 1 })).toMatchObject({ threshold: 0.3, start: 1 });
  for (const input of [
    { assetId: "../private", operation: "audio" },
    { assetId: "clip", operation: "exec" },
    { assetId: "clip", operation: "frame", start: Infinity },
    { assetId: "clip", operation: "reverse", source: "C:/private" },
  ]) expect(() => mediaOperationSchema.parse(input)).toThrow();
});
