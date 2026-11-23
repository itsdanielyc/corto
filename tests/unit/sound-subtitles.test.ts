import { describe, expect, it } from "vitest";
import {
  audioGain,
  audioSourceTime,
  createAudioClip,
  duckingWindows,
  placeNextSong,
} from "../../src/domain/audio";
import { createProject, createScene } from "../../src/domain/project";
import { parseSrt, serializeSrt, subtitleAt } from "../../src/domain/subtitles";
import { estimatedMovieBytes, sampleProject } from "../../src/export/presets";

describe("sound and subtitle editing", () => {
  it("keeps source trim, loop, fade and ducking gains independent", () => {
    const asset = {
      id: "audio",
      kind: "audio" as const,
      name: "Voice.wav",
      mime: "audio/wav",
      duration: 10,
      size: 20,
      width: 0,
      height: 0,
    };
    const clip = {
      ...createAudioClip(asset, "music", 3),
      duration: 6,
      offset: 2,
      fadeIn: 2,
      fadeOut: 2,
      loop: true,
    };
    expect(audioGain(clip, 2)).toBe(0);
    expect(audioGain(clip, 4)).toBe(0.25);
    expect(audioGain(clip, 6, true)).toBe(0.125);
    expect(audioGain(clip, 9)).toBe(0);
    expect(audioSourceTime(clip, 12, 10)).toBe(3);
    const project = {
      ...createProject(),
      audioClips: [{ ...clip, role: "voiceover" as const }],
      assets: { audio: asset },
    };
    expect(duckingWindows(project)).toEqual([{ start: 3, end: 9 }]);
    const video = {
      ...asset,
      id: "silent",
      kind: "video" as const,
      mime: "video/mp4",
      hasAudio: false,
    };
    const silentFilm = {
      ...createProject(),
      assets: { silent: video },
      scenes: [{ ...createScene(video), duration: 2 }],
    };
    expect(duckingWindows(silentFilm)).toEqual([]);
    expect(
      duckingWindows({
        ...silentFilm,
        assets: { silent: { ...video, hasAudio: true } },
      }),
    ).toEqual([{ start: 0, end: 2 }]);
    const legacy = {
      ...project,
      audioClips: [
        {
          ...createAudioClip(asset, "music"),
          duration: 20,
          loop: true,
          followFilm: true,
        },
      ],
      scenes: [{ ...createScene(null), duration: 20 }],
    };
    const sequence = placeNextSong(legacy, asset);
    expect(
      sequence.audioClips.map((sound) => [sound.start, sound.duration]),
    ).toEqual([
      [0, 10],
      [10, 10],
    ]);
    expect(sequence).not.toHaveProperty("music");
  });
  it("round-trips Unicode SRT, finds exact boundaries and rejects malformed or overlapping cues", () => {
    const cues = parseSrt(
      "\uFEFF1\r\n00:00:01,200 --> 00:00:02,000\r\nHello 家族\r\n\r\n2\r\n00:00:02,000 --> 00:00:03,400\r\nA memory",
    );
    expect(cues[0].text).toBe("Hello 家族");
    expect(subtitleAt(cues, 1.199)).toBeNull();
    expect(subtitleAt(cues, 2)?.text).toBe("A memory");
    expect(subtitleAt(cues, 3.4)).toBeNull();
    expect(
      parseSrt(serializeSrt(cues)).map(({ start, end, text }) => ({
        start,
        end,
        text,
      })),
    ).toEqual(cues.map(({ start, end, text }) => ({ start, end, text })));
    expect(() => parseSrt("1\n00:65:00,000 --> 00:66:00,000\nWrong")).toThrow(
      /timestamp/,
    );
    expect(() =>
      parseSrt(
        "1\n00:00:00,000 --> 00:00:02,000\nOne\n\n2\n00:00:01,000 --> 00:00:03,000\nTwo",
      ),
    ).toThrow(/overlap/);
  });

  it("preserves comparisons, literal markup, ampersands and blank lines in editable SRT text", () => {
    const cue = {
      id: "cue-1",
      start: 0,
      end: 2,
      text: "2 < 3 and 5 > 4 & <i>literal</i>\n\nNext line",
    };
    expect(parseSrt(serializeSrt([cue]))[0].text).toBe(cue.text);
    expect(
      parseSrt("1\n00:00:00,000 --> 00:00:02,000\n<i>2 < 3 and 5 > 4</i>")[0]
        .text,
    ).toBe("2 < 3 and 5 > 4");
  });
  it("estimates smaller sharing output and cuts a sample without changing the film", () => {
    const project = {
      ...createProject(),
      scenes: [
        { ...createScene(null), duration: 4 },
        { ...createScene(null), duration: 4 },
      ],
    };
    expect(
      sampleProject(project, true).scenes.map((scene) => scene.duration),
    ).toEqual([4, 1]);
    expect(project.scenes[1].duration).toBe(4);
    expect(estimatedMovieBytes(60, "small")).toBeLessThan(
      estimatedMovieBytes(60, "phone"),
    );
  });
});
