import { expect, it } from "vitest";
import { withEncoderFallback } from "../../electron/encoder-recovery";
it("falls back once for a real hardware failure and never repeats cancelled or failed software work", async () => {
  const encoder = { name: "h264_test", threads: 2, quality: 70 };
  let calls = 0;
  let fallback = 0;
  expect(
    await withEncoderFallback(
      encoder,
      new AbortController().signal,
      () => fallback++,
      async () => {
        calls++;
        if (encoder.name !== "libx264") throw new Error("Device lost");
        return "encoded";
      },
    ),
  ).toBe("encoded");
  expect(calls).toBe(2);
  expect(fallback).toBe(1);
  const controller = new AbortController();
  controller.abort();
  await expect(
    withEncoderFallback(
      { name: "hardware", threads: 1, quality: 70 },
      controller.signal,
      () => {
        throw new Error("Unexpected fallback");
      },
      async () => {
        throw new Error("cancelled");
      },
    ),
  ).rejects.toThrow("cancelled");
});
