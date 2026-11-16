export const VOICE_SAMPLE_RATE = 48000;
export const MAX_VOICE_SECONDS = 300;

// Time O(samples), space O(samples). The recorder is capped at five minutes of mono PCM.
/** Write a standard PCM WAV, so recorded narration has reliable duration on every platform. */
export function encodeMonoWav(
  samples: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      view.setUint8(offset + index, value.charCodeAt(index));
  };
  ascii(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(
      44 + index * 2,
      Math.round(sample * (sample < 0 ? 32768 : 32767)),
      true,
    );
  }
  return buffer;
}

/** Decode locally, downmix and resample before storing a portable narration original. */
export async function voiceRecordingFile(blob: Blob): Promise<File> {
  const decoder = new AudioContext();
  try {
    const decoded = await decoder.decodeAudioData(await blob.arrayBuffer());
    if (decoded.duration <= 0 || decoded.duration > MAX_VOICE_SECONDS + 2)
      throw new Error("Record narration in sections of up to five minutes");
    const offline = new OfflineAudioContext(
      1,
      Math.ceil(decoded.duration * VOICE_SAMPLE_RATE),
      VOICE_SAMPLE_RATE,
    );
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const audio = await offline.startRendering();
    return new File(
      [encodeMonoWav(audio.getChannelData(0), VOICE_SAMPLE_RATE)],
      `Narration ${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.wav`,
      { type: "audio/wav" },
    );
  } finally {
    await decoder.close();
  }
}
