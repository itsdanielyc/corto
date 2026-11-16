import { describe, expect, it } from "vitest";
import { parseProject } from "../../contracts/project";
import { createProject } from "../../src/domain/project";

describe("v0.1.1 project evolution", () => {
  it("creates v2 projects and migrates only the known v1 shape without losing edits", () => {
    expect(createProject().schemaVersion).toBe(2);
    const legacy = {
      schemaVersion: 1,
      id: "old-film",
      name: "Keep this",
      ratio: "square",
      assets: {},
      scenes: [],
      music: null,
    };
    expect(parseProject(legacy)).toMatchObject({
      ...legacy,
      schemaVersion: 2,
      audioClips: [],
      subtitles: [],
      duckMusic: false,
    });
    expect(() => parseProject({ ...legacy, schemaVersion: 99 })).toThrow();
  });

  it("preserves valid timed sound and subtitles and rejects overlaps or out-of-source audio", () => {
    const asset = {
      id: "song",
      name: "Song.wav",
      mime: "audio/wav",
      kind: "audio",
      size: 100,
      duration: 10,
      width: 0,
      height: 0,
    };
    const sound = {
      id: "sound",
      assetId: "song",
      role: "music",
      start: 1,
      offset: 2,
      duration: 4,
      volume: 0.5,
      fadeIn: 0.5,
      fadeOut: 1,
      loop: false,
    };
    const cues = [
      { id: "cue-a", start: 0, end: 1, text: "Hello 家族" },
      { id: "cue-b", start: 1, end: 2, text: "A memory" },
    ];
    const project = {
      ...createProject(),
      assets: { song: asset },
      audioClips: [sound],
      subtitles: cues,
      duckMusic: true,
    };
    expect(parseProject(project).subtitles).toEqual(cues);
    expect(() =>
      parseProject({
        ...project,
        subtitles: [{ ...cues[0], end: 1.5 }, cues[1]],
      }),
    ).toThrow(/overlap/i);
    expect(() =>
      parseProject({ ...project, audioClips: [{ ...sound, offset: 8 }] }),
    ).toThrow(/source/i);
  });
});
