import { expect, it } from "vitest";
import { analyseSound, packSoundLanes } from "../../src/domain/sound-analysis";
it("analyses actual sample peaks and spaced onsets without inventing activity in silence", () => {
  const samples = new Float32Array(2000);
  samples.fill(0.5, 500, 600);
  samples.fill(0.8, 1500, 1600);
  const analysis = analyseSound(samples, 1000, 20);
  expect(analysis.peaks[5]).toBeCloseTo(0.5);
  expect(analysis.peaks[15]).toBeCloseTo(0.8);
  expect(analysis.beats).toEqual([0.5, 1.5]);
  expect(analyseSound(new Float32Array(1000), 1000).beats).toEqual([]);
});
it("packs overlaps into separate lanes and reuses a lane at an exact boundary", () => {
  const clips = [
    { id: "a", start: 0, duration: 1 },
    { id: "b", start: 0.5, duration: 1 },
    { id: "c", start: 1, duration: 1 },
  ];
  expect(
    packSoundLanes(clips).map((item) => [item.clip.id, item.lane]),
  ).toEqual([
    ["a", 0],
    ["b", 1],
    ["c", 0],
  ]);
});
