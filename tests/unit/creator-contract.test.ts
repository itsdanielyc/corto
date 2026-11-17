import { describe, expect, it } from "vitest";
import { parseProject } from "../../contracts/project";
import { createProject, createScene } from "../../src/domain/project";

describe("creator project contract", () => {
  it("creates schema 3 and migrates known projects into a single sound model", () => {
    expect(createProject().schemaVersion).toBe(3);
    const audio = {
      id: "music",
      name: "Song.wav",
      kind: "audio",
      mime: "audio/wav",
      size: 40,
      duration: 8,
      width: 0,
      height: 0,
    };
    const legacyScene = {
      id: "card",
      assetId: null,
      duration: 5,
      start: 0,
      caption: "Keep this text",
      captionStyle: "classic",
      captionPosition: "center",
      fit: "cover",
      transition: "cut",
      volume: 1,
      background: "#151517",
    };
    const legacy = {
      schemaVersion: 2,
      id: "legacy",
      name: "Keep this",
      ratio: "landscape",
      assets: { music: audio },
      scenes: [legacyScene],
      music: { assetId: "music", volume: 0.5, loop: true },
      audioClips: [],
      subtitles: [],
      duckMusic: false,
    };
    const migrated = parseProject(legacy);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated).not.toHaveProperty("music");
    expect(migrated.audioClips).toMatchObject([
      { assetId: "music", volume: 0.5, loop: true },
    ]);
    expect(migrated.assets.music).toEqual(audio);
    const collision = parseProject({
      ...legacy,
      audioClips: [
        {
          id: "migrated-soundtrack",
          assetId: "music",
          role: "voiceover",
          start: 1,
          offset: 0,
          duration: 2,
          volume: 1,
          fadeIn: 0,
          fadeOut: 0,
          loop: false,
        },
      ],
    });
    expect(new Set(collision.audioClips.map((clip) => clip.id)).size).toBe(2);
    expect(collision.audioClips[1].id).toBe("migrated-soundtrack");
    expect(() => parseProject({ ...legacy, schemaVersion: 99 })).toThrow();
  });
  it("accepts explicit creative data while rejecting invalid transforms and impossible speed trims", () => {
    const project = createProject();
    const scene = {
      ...createScene(null),
      transform: {
        rotation: 90,
        flipX: false,
        flipY: true,
        focusX: 0.25,
        focusY: 0.6,
        zoom: 1.2,
        endFocusX: 0.75,
        endFocusY: 0.6,
        endZoom: 1.4,
        motion: "custom",
      },
      transition: "dissolve",
      transitionSeconds: 0.5,
    };
    expect(
      parseProject({ ...project, scenes: [scene] }).scenes[0].transform
        .rotation,
    ).toBe(90);
    expect(() =>
      parseProject({
        ...project,
        scenes: [{ ...scene, transform: { ...scene.transform, zoom: 0 } }],
      }),
    ).toThrow();
    const video = {
      id: "clip",
      name: "Clip.mp4",
      kind: "video",
      mime: "video/mp4",
      size: 10,
      duration: 4,
      width: 96,
      height: 64,
    };
    expect(() =>
      parseProject({
        ...project,
        assets: { clip: video },
        scenes: [
          { ...scene, assetId: "clip", start: 1, duration: 2, speed: 2 },
        ],
      }),
    ).toThrow(/source|trim/i);
  });
  it("accepts a 500-photo tribute with long dedications without weakening source validation", () => {
    const photo = {
      id: "memory",
      name: "Memory.png",
      kind: "image",
      mime: "image/png",
      size: 30,
      duration: 0,
      width: 96,
      height: 64,
    };
    const base = createScene(null);
    const scenes = Array.from({ length: 500 }, (_, index) => ({
      ...base,
      id: `memory-${index}`,
      assetId: "memory",
      duration: 4,
      caption:
        `A memory ${index}: ` + "A dedication worth keeping. ".repeat(20),
    }));
    const project = parseProject({
      ...createProject("Tribute"),
      assets: { memory: photo },
      scenes,
    });
    expect(project.scenes).toHaveLength(500);
    expect(project.scenes[499].caption.length).toBeGreaterThan(160);
  });
});
