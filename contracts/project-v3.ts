import { z } from "zod";
import { parseProject as parseLegacyProject } from "./legacy-project";
import {
  adjustmentSchema,
  backdropSchema,
  outputSettingsSchema,
  projectDefaultsSchema,
  subtitleStyleSchema,
  textItemSchema,
  transformSchema,
  visualLayerSchema,
} from "./creative";
import {
  colourSchema,
  identifierSchema,
  LIMITS,
  ratioSchema,
  resolutionSchema,
  transitionSchema,
} from "./values";
export {
  DEFAULT_PHOTO_SECONDS,
  DEFAULT_PROJECT_NAME,
  EXPORT_FPS,
  FADE_SECONDS,
  identifierSchema,
  LIMITS,
} from "./values";
export type {
  Transform,
  Adjustments,
  TextItem,
  VisualLayer,
  OutputSettings,
  ProjectDefaults,
  Preferences,
  SubtitleStyle,
} from "./creative";

const IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/svg+xml",
];
const VIDEO_MIMES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/ogg",
  "video/x-ms-wmv",
  "video/x-msvideo",
  "video/x-matroska",
  "video/mp2t",
  "video/mpeg",
  "video/3gpp",
  "image/gif",
];
const AUDIO_MIMES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
  "audio/mp4",
  "audio/aac",
  "audio/webm",
  "audio/x-ms-wma",
];

/** Immutable media metadata is separate from edits and never contains an external path. */
export const mediaAssetSchema = z
  .strictObject({
    id: identifierSchema,
    name: z.string().min(1).max(255),
    kind: z.enum(["image", "video", "audio", "lut"]),
    mime: z.string().max(80),
    size: z.number().int().positive().max(LIMITS.assetBytes),
    duration: z
      .number()
      .finite()
      .min(0)
      .max(24 * 3600),
    width: z.number().int().min(0).max(32768),
    height: z.number().int().min(0).max(32768),
    originalAssetId: identifierSchema.optional(),
    isOriginalOnly: z.boolean().optional(),
    proxyAssetId: identifierSchema.optional(),
    isProxy: z.boolean().optional(),
    capturedAt: z.iso.datetime({ offset: true }).optional(),
    fileDate: z.iso.datetime({ offset: true }).optional(),
    camera: z.string().max(160).optional(),
    fps: z.number().finite().min(0.1).max(240).optional(),
    hasAudio: z.boolean().optional(),
    animated: z.boolean().optional(),
  })
  .superRefine((asset, context) => {
    const allowed =
      asset.kind === "image"
        ? IMAGE_MIMES
        : asset.kind === "video"
          ? VIDEO_MIMES
          : asset.kind === "audio"
            ? AUDIO_MIMES
            : ["application/x-cube"];
    if (!allowed.includes(asset.mime))
      context.addIssue({
        code: "custom",
        message: "This media format is not supported",
      });
    if (
      (asset.kind === "audio" || asset.kind === "video") &&
      asset.duration <= 0
    )
      context.addIssue({
        code: "custom",
        message: "Media has no playable duration",
      });
    if (
      (asset.kind === "image" || asset.kind === "video") &&
      (asset.width <= 0 || asset.height <= 0)
    )
      context.addIssue({
        code: "custom",
        message: "Media has no visible dimensions",
      });
    if (asset.kind === "lut" && asset.size > 4 * 1024 ** 2)
      context.addIssue({
        code: "custom",
        message: "A colour look must be smaller than 4 MB",
      });
  });
export const sceneSchema = z.strictObject({
  id: identifierSchema,
  assetId: identifierSchema.nullable(),
  duration: z
    .number()
    .finite()
    .min(LIMITS.minimumSceneSeconds)
    .max(LIMITS.sceneSeconds),
  start: z
    .number()
    .finite()
    .min(0)
    .max(24 * 3600),
  caption: z.string().max(LIMITS.captionCharacters),
  captionStyle: z.enum(["classic", "modern", "minimal"]),
  captionPosition: z.enum(["center", "bottom"]),
  fit: z.enum(["cover", "contain"]),
  transition: transitionSchema,
  volume: z.number().finite().min(0).max(4),
  background: colourSchema,
  transitionSeconds: z.number().finite().min(0).max(5).default(0.3),
  speed: z.number().finite().min(0.1).max(8).default(1),
  preservePitch: z.boolean().default(true),
  loop: z.boolean().default(false),
  transform: transformSchema.prefault({}),
  adjustments: adjustmentSchema.prefault({}),
  backdrop: backdropSchema.prefault({}),
  captionShade: z.boolean().default(true),
  textItems: z.array(textItemSchema).max(LIMITS.textItems).default([]),
  layers: z.array(visualLayerSchema).max(LIMITS.visualLayers).default([]),
  audioFadeIn: z.number().finite().min(0).max(30).default(0),
  audioFadeOut: z.number().finite().min(0).max(30).default(0),
  keyColour: colourSchema.nullable().default(null),
  keyTolerance: z.number().finite().min(0.01).max(0.8).default(0.15),
  group: z.string().max(80).default(""),
});
export const audioClipSchema = z.strictObject({
  id: identifierSchema,
  assetId: identifierSchema,
  role: z.enum(["music", "voiceover"]),
  start: z.number().finite().min(0).max(LIMITS.filmSeconds),
  offset: z.number().finite().min(0),
  duration: z.number().finite().positive().max(LIMITS.filmSeconds),
  volume: z.number().finite().min(0).max(4),
  fadeIn: z.number().finite().min(0).max(30),
  fadeOut: z.number().finite().min(0).max(30),
  loop: z.boolean(),
  followFilm: z.boolean().default(false),
});
export const subtitleSchema = z.strictObject({
  id: identifierSchema,
  start: z.number().finite().min(0).max(LIMITS.filmSeconds),
  end: z.number().finite().positive().max(LIMITS.filmSeconds),
  text: z.string().trim().min(1).max(1000),
});
export const markerSchema = z.strictObject({
  id: identifierSchema,
  time: z.number().finite().min(0).max(LIMITS.filmSeconds),
  name: z.string().trim().min(1).max(100),
  chapter: z.boolean().default(false),
});
export const projectSchema = z.strictObject({
  schemaVersion: z.literal(3),
  id: identifierSchema,
  name: z.string().trim().min(1).max(80),
  ratio: ratioSchema,
  assets: z.record(identifierSchema, mediaAssetSchema),
  scenes: z.array(sceneSchema).max(LIMITS.scenes),
  audioClips: z.array(audioClipSchema).max(LIMITS.audioClips),
  subtitles: z.array(subtitleSchema).max(LIMITS.subtitles),
  duckMusic: z.boolean(),
  defaults: projectDefaultsSchema.prefault({}),
  output: outputSettingsSchema.prefault({}),
  subtitleStyle: subtitleStyleSchema.prefault({}),
  markers: z.array(markerSchema).max(LIMITS.markers).default([]),
});
export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Project = z.infer<typeof projectSchema>;
export type AspectRatio = Project["ratio"];
export type ExportResolution = z.infer<typeof resolutionSchema>;
export type AudioClip = z.infer<typeof audioClipSchema>;
export type Subtitle = z.infer<typeof subtitleSchema>;
export type Marker = z.infer<typeof markerSchema>;

/** Check media bounds independently so local edits do not clone an entire library. */
export function assertSceneMedia(
  scene: Scene,
  assets: Project["assets"],
): void {
  if (scene.assetId === null) {
    if (scene.start !== 0) throw new Error("Title cards must start at zero");
    return;
  }
  const asset = assets[scene.assetId];
  if (
    !Object.hasOwn(assets, scene.assetId) ||
    !asset ||
    (asset.kind !== "image" && asset.kind !== "video") ||
    asset.isOriginalOnly
  )
    throw new Error("A scene references missing or invalid media");
  if (asset.kind === "image" && scene.start !== 0)
    throw new Error("Photos must start at zero");
  if (
    asset.kind === "video" &&
    (scene.start >= asset.duration ||
      (!scene.loop &&
        scene.start + scene.duration * scene.speed > asset.duration + 0.001))
  )
    throw new Error("The trim extends beyond the source clip");
}

/** The old strict parser is frozen: only known versions enter migration. */
function migrateKnownProject(input: unknown): unknown {
  if (
    !input ||
    typeof input !== "object" ||
    !("schemaVersion" in input) ||
    (input.schemaVersion !== 1 && input.schemaVersion !== 2)
  )
    return input;
  const legacy = parseLegacyProject(input);
  const { music, ...project } = legacy;
  const duration = legacy.scenes.reduce(
    (sum, scene) => sum + scene.duration,
    0,
  );
  const soundDuration = music
    ? music.loop
      ? duration || legacy.assets[music.assetId].duration
      : Math.min(
          duration || legacy.assets[music.assetId].duration,
          legacy.assets[music.assetId].duration,
        )
    : 0;
  const existingIds = new Set(project.audioClips.map((clip) => clip.id));
  let soundId = "migrated-soundtrack";
  for (let suffix = 1; existingIds.has(soundId); suffix++)
    soundId = `migrated-soundtrack-${suffix}`;
  const legacySound = music
    ? [
        {
          id: soundId,
          assetId: music.assetId,
          role: "music",
          start: 0,
          offset: 0,
          duration: soundDuration,
          volume: music.volume,
          loop: music.loop,
          fadeIn: Math.min(0.3, soundDuration / 2),
          fadeOut: Math.min(0.3, soundDuration / 2),
          followFilm: music.loop,
        },
      ]
    : [];
  return {
    ...project,
    schemaVersion: 3,
    audioClips: [...legacySound, ...project.audioClips],
  };
}

// Time O(scenes + assets + sounds + layers + cues), space O(parsed data + identifier sets).
/** Validate untrusted manifests and all cross-references before platform effects run. */
export function parseProject(input: unknown): Project {
  const project = projectSchema.parse(migrateKnownProject(input));
  let bytes = 0;
  for (const [id, asset] of Object.entries(project.assets)) {
    if (id !== asset.id) throw new Error("Media identifiers do not match");
    bytes += asset.size;
    if (asset.originalAssetId) {
      const original = project.assets[asset.originalAssetId];
      if (
        !original?.isOriginalOnly ||
        original.originalAssetId ||
        original.kind !== asset.kind ||
        original.id === id
      )
        throw new Error(
          "The compatible media copy references an invalid original",
        );
    }
    if (asset.proxyAssetId) {
      const proxy = project.assets[asset.proxyAssetId];
      if (
        !proxy ||
        proxy.kind !== asset.kind ||
        proxy.isOriginalOnly ||
        proxy.proxyAssetId ||
        asset.proxyAssetId === id
      )
        throw new Error("The proxy references invalid media");
    }
  }
  if (Object.keys(project.assets).length > LIMITS.assets)
    throw new Error("This project has too many media files");
  if (bytes > LIMITS.projectBytes)
    throw new Error("This project exceeds the 64 GB media limit");
  const sceneIds = new Set<string>();
  let duration = 0;
  for (const scene of project.scenes) {
    if (sceneIds.has(scene.id))
      throw new Error("Scene identifiers must be unique");
    sceneIds.add(scene.id);
    duration += scene.duration;
    assertSceneMedia(scene, project.assets);
    const layerIds = new Set<string>();
    for (const item of [...scene.textItems, ...scene.layers]) {
      if (layerIds.has(item.id))
        throw new Error("Layer identifiers must be unique within a scene");
      layerIds.add(item.id);
      if (item.end !== null && item.end <= item.start)
        throw new Error("A layer must end after it starts");
    }
    for (const layer of scene.layers)
      if (
        layer.kind === "media" &&
        (!layer.assetId ||
          !project.assets[layer.assetId] ||
          !["image", "video"].includes(project.assets[layer.assetId].kind) ||
          project.assets[layer.assetId].isOriginalOnly)
      )
        throw new Error("An overlay references missing visual media");
    if (
      scene.backdrop.assetId &&
      (!project.assets[scene.backdrop.assetId] ||
        project.assets[scene.backdrop.assetId].kind !== "image")
    )
      throw new Error("A backdrop references missing image media");
    if (
      scene.adjustments.lutAssetId &&
      project.assets[scene.adjustments.lutAssetId]?.kind !== "lut"
    )
      throw new Error("A look references missing lookup data");
  }
  if (duration > LIMITS.filmSeconds)
    throw new Error("Keep this film within three hours");
  const soundIds = new Set<string>();
  for (const clip of project.audioClips) {
    const asset = project.assets[clip.assetId];
    if (soundIds.has(clip.id))
      throw new Error("Sound identifiers must be unique");
    soundIds.add(clip.id);
    if (!asset || asset.kind !== "audio" || asset.isOriginalOnly)
      throw new Error("A sound references missing audio media");
    if (
      clip.offset >= asset.duration ||
      (!clip.loop && clip.offset + clip.duration > asset.duration + 0.001)
    )
      throw new Error("The audio trim extends beyond its source");
    if (
      clip.fadeIn + clip.fadeOut > clip.duration ||
      clip.start + clip.duration > LIMITS.filmSeconds
    )
      throw new Error("The sound timing exceeds its bounds");
  }
  let previousEnd = 0;
  const subtitleIds = new Set<string>();
  for (const cue of project.subtitles) {
    if (subtitleIds.has(cue.id))
      throw new Error("Subtitle identifiers must be unique");
    subtitleIds.add(cue.id);
    if (cue.end <= cue.start)
      throw new Error("A subtitle must end after it starts");
    if (cue.start < previousEnd)
      throw new Error("Subtitles must be ordered without overlap");
    previousEnd = cue.end;
  }
  const markerIds = new Set<string>();
  for (const marker of project.markers) {
    if (markerIds.has(marker.id))
      throw new Error("Marker identifiers must be unique");
    markerIds.add(marker.id);
  }
  const serialized = JSON.stringify(project);
  if (
    serialized.length > LIMITS.manifestBytes / 3 &&
    new TextEncoder().encode(serialized).byteLength > LIMITS.manifestBytes
  )
    throw new Error(
      "This film's editing data exceeds the 16 MB manifest limit; reduce long text or layers before saving",
    );
  return project;
}
