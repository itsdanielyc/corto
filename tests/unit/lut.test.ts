import { expect, it } from "vitest";
import { parseColourLut } from "../../src/domain/lut";

it("identifies the original line of an invalid .cube sample", () => {
  expect(() => parseColourLut("# look\nLUT_3D_SIZE 2\n\n0 1")).toThrow(
    /line 4/i,
  );
});
