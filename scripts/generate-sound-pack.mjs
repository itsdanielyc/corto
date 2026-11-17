import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";

const directory = "public/sounds";
await mkdir(directory, { recursive: true });
const sampleRate = 22050;
const titles = [
  "Morning light",
  "Old photographs",
  "Home again",
  "Little adventures",
  "Sunday afternoon",
  "First steps",
  "Garden party",
  "A letter home",
  "Seaside postcards",
  "The long way back",
  "Golden hour",
  "Small celebrations",
  "Together always",
  "Winter window",
  "Remembering you",
  "Paper lanterns",
  "New beginnings",
  "The quiet years",
  "Summer kitchen",
  "Until next time",
];
const instruments = [
  "soft keys",
  "plucked strings",
  "warm bells",
  "gentle pad",
];
const modes = [
  [0, 2, 4, 7, 9],
  [0, 3, 5, 7, 10],
  [0, 2, 5, 7, 9],
  [0, 4, 5, 7, 11],
];
const entries = [];
function wav(samples) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write("RIFF");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) =>
    bytes.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, sample)) * 32767),
      44 + index * 2,
    ),
  );
  return bytes;
}
function encode(samples, file) {
  const result = spawnSync(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "wav",
      "-i",
      "pipe:0",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "96k",
      "-ar",
      String(sampleRate),
      join(directory, file),
    ],
    { input: wav(samples), windowsHide: true },
  );
  if (result.status) throw new Error(result.stderr.toString());
}
// Time O(samples × voices), space O(one track). Every composition and instrument is deterministic and original.
for (const [index, title] of titles.entries()) {
  const bpm = [72, 80, 88, 96, 104][index % 5];
  const beatSeconds = 60 / bpm;
  const beats = 64;
  const duration = beats * beatSeconds;
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  const root = 48 + (index % 12);
  const mode = modes[index % modes.length];
  const style = index % 4;
  for (let beat = 0; beat < beats; beat++) {
    const chord = [0, 5, 3, 4][Math.floor(beat / 8) % 4];
    const degree =
      mode[(beat * ((index % 3) + 1) + Math.floor(beat / 8)) % mode.length];
    const notes =
      beat % 4 === 0
        ? [root + chord, root + chord + 7, root + 12 + degree]
        : [root + 12 + degree];
    for (const [voice, note] of notes.entries()) {
      const frequency = 440 * 2 ** ((note - 69) / 12);
      const start = Math.floor(beat * beatSeconds * sampleRate);
      const length = Math.min(
        samples.length - start,
        Math.floor(beatSeconds * (voice ? 1.8 : 3.5) * sampleRate),
      );
      for (let offset = 0; offset < length; offset++) {
        const t = offset / sampleRate;
        const attack = Math.min(1, t / (style === 3 ? 0.18 : 0.012));
        const decay = Math.exp(-t * (style === 1 ? 4 : style === 3 ? 1 : 2));
        const release = Math.min(1, (length - offset) / (sampleRate * 0.15));
        const fundamental = Math.sin(2 * Math.PI * frequency * t);
        const overtone =
          Math.sin(2 * Math.PI * frequency * (style === 2 ? 2.01 : 2) * t) *
          (style === 0 ? 0.18 : style === 2 ? 0.3 : 0.08);
        samples[start + offset] +=
          (fundamental + overtone) *
          attack *
          decay *
          release *
          (voice ? 0.12 : 0.09);
      }
    }
  }
  const fade = Math.min(1, duration / 2) * sampleRate;
  for (let i = 0; i < samples.length; i++)
    samples[i] *= Math.min(1, i / fade, (samples.length - 1 - i) / fade);
  const id = `music-${String(index + 1).padStart(2, "0")}`;
  encode(samples, `${id}.mp3`);
  entries.push({
    id,
    title,
    category: "music",
    description: `${instruments[style]} · ${bpm} bpm`,
    bpm,
    file: `${id}.mp3`,
    licence: "CC0-1.0",
  });
}
const sounds = [
  "Soft chime",
  "Camera click",
  "Gentle whoosh",
  "Small pop",
  "Bell",
  "Sparkle",
  "Page turn",
  "Wood tick",
];
for (const [index, title] of sounds.entries()) {
  const duration = [2, 0.25, 1.2, 0.35, 2.5, 1.8, 0.7, 0.2][index];
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  let random = 12345 + index;
  for (let i = 0; i < samples.length; i++) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const noise = random / 2147483648 - 1;
    const t = i / sampleRate;
    const envelope =
      Math.min(1, t / 0.005) *
      Math.exp(-t * (index % 2 ? 18 : 3)) *
      Math.min(1, (duration - t) / 0.05);
    const tone = Math.sin(
      2 *
        Math.PI *
        (index === 3 ? 420 * Math.exp(-t * 12) : 660 + index * 90) *
        t,
    );
    samples[i] =
      (index === 2 || index === 6
        ? noise * Math.sin((Math.PI * t) / duration)
        : index === 1 || index === 7
          ? noise * 0.7 + tone * 0.3
          : tone + Math.sin(2 * Math.PI * 1320 * t) * 0.25) *
      envelope *
      0.3;
  }
  const id = `effect-${String(index + 1).padStart(2, "0")}`;
  encode(samples, `${id}.mp3`);
  entries.push({
    id,
    title,
    category: "effect",
    description: "Original sound effect",
    file: `${id}.mp3`,
    licence: "CC0-1.0",
  });
}
await writeFile(
  join(directory, "index.json"),
  JSON.stringify(entries, null, 2) + "\n",
);
await writeFile(
  join(directory, "LICENSE.txt"),
  "Corto original sound pack\n\nAll 20 musical compositions, recordings, synthesis patches and eight sound effects in this directory are dedicated to the public domain under CC0 1.0 Universal. No third-party recordings, samples or compositions were used.\n\nGenerated reproducibly by scripts/generate-sound-pack.mjs. You may use, edit and redistribute these sounds commercially or otherwise without attribution.\nhttps://creativecommons.org/publicdomain/zero/1.0/\n",
);
console.log(`Generated ${entries.length} original CC0 tracks/effects.`);
