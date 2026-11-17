import type { Encoder } from "../src/export/ffmpeg-types";
/** A successful hardware probe can still fail for a real frame size or a reset device; retry that bounded part in software. */
export async function withEncoderFallback<T>(
  encoder: Encoder,
  signal: AbortSignal,
  onFallback: () => void,
  encode: () => Promise<T>,
): Promise<T> {
  try {
    return await encode();
  } catch (error) {
    if (signal.aborted || encoder.name === "libx264") throw error;
    encoder.name = "libx264";
    onFallback();
    return encode();
  }
}
