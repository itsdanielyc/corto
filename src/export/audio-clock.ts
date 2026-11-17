/** Wait for the actual output clock before recording, avoiding empty audio tracks during device startup. */
export async function waitForAudioClock(
  audio: AudioContext,
  signal: AbortSignal,
): Promise<void> {
  await audio.resume();
  const baseline = audio.currentTime;
  const started = performance.now();
  while (audio.currentTime <= baseline) {
    signal.throwIfAborted();
    if (performance.now() - started > 10000)
      throw new Error(
        "The browser audio device did not start. Check the output device and try again.",
      );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  }
}
