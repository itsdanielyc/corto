import { z } from "zod";

/** Product limits bound rendering cost, history size and untrusted project inputs. */
export const LIMITS = {
  scenes: 300,
  assets: 500,
  assetBytes: 2 * 1024 ** 3,
  projectBytes: 8 * 1024 ** 3,
  filmSeconds: 30 * 60,
  sceneSeconds: 10 * 60,
  minimumSceneSeconds: 0.25,
  manifestBytes: 4 * 1024 ** 2,
  captionCharacters: 160,
  history: 50,
  audioClips: 100,
  subtitles: 500,
} as const;

export const DEFAULT_PHOTO_SECONDS = 5;
export const EXPORT_FPS = 30;
export const FADE_SECONDS = 0.3;
export const identifierSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,80}$/, "Invalid media identifier")
  .refine(
    (identifier) => !Object.hasOwn(Object.prototype, identifier),
    "Reserved media identifier",
  );

const imageMimes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/heic",
  "image/heif",
] as const;
const videoMimes = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/ogg",
] as const;
const audioMimes = [
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
] as const;

export const mediaAssetSchema = z
  .strictObject({
    id: identifierSchema,
    name: z.string().min(1).max(255),
    kind: z.enum(["image", "video", "audio"]),
    mime: z.string().max(80),
    size: z.number().int().positive().max(LIMITS.assetBytes),
    duration: z
      .number()
      .finite()
      .min(0)
      .max(24 * 60 * 60),
    width: z.number().int().min(0).max(32768),
    height: z.number().int().min(0).max(32768),
    originalAssetId: identifierSchema.optional(),
    isOriginalOnly: z.boolean().optional(),
  })
  .superRefine((asset, context) => {
    const allowed: readonly string[] =
      asset.kind === "image"
        ? imageMimes
        : asset.kind === "video"
          ? videoMimes
          : audioMimes;
    if (!allowed.includes(asset.mime))
      context.addIssue({
        code: "custom",
        message: "This media format is not supported",
      });
    if (asset.kind !== "image" && asset.duration <= 0)
      context.addIssue({
        code: "custom",
        message: "Media has no playable duration",
      });
    if (asset.kind !== "audio" && (asset.width <= 0 || asset.height <= 0))
      context.addIssue({
        code: "custom",
        message: "Media has no visible dimensions",
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
    .max(24 * 60 * 60),
  caption: z.string().max(LIMITS.captionCharacters),
  captionStyle: z.enum(["classic", "modern", "minimal"]),
  captionPosition: z.enum(["center", "bottom"]),
  fit: z.enum(["cover", "contain"]),
  transition: z.enum(["cut", "fade"]),
  volume: z.number().finite().min(0).max(1),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const audioClipSchema = z.strictObject({
  id: identifierSchema,
  assetId: identifierSchema,
  role: z.enum(["music", "voiceover"]),
  start: z.number().finite().min(0).max(LIMITS.filmSeconds),
  offset: z.number().finite().min(0),
  duration: z.number().finite().positive().max(LIMITS.filmSeconds),
  volume: z.number().finite().min(0).max(1),
  fadeIn: z.number().finite().min(0).max(30),
  fadeOut: z.number().finite().min(0).max(30),
  loop: z.boolean(),
});
export const subtitleSchema = z.strictObject({
  id: identifierSchema,
  start: z.number().finite().min(0).max(LIMITS.filmSeconds),
  end: z.number().finite().positive().max(LIMITS.filmSeconds),
  text: z.string().trim().min(1).max(240),
});

export const projectSchema = z.strictObject({
  schemaVersion: z.literal(2),
  id: identifierSchema,
  name: z.string().trim().min(1).max(80),
  ratio: z.enum(["landscape", "portrait", "square"]),
  assets: z.record(identifierSchema, mediaAssetSchema),
  scenes: z.array(sceneSchema).max(LIMITS.scenes),
  music: z
    .strictObject({
      assetId: identifierSchema,
      volume: z.number().finite().min(0).max(1),
      loop: z.boolean(),
    })
    .nullable(),
  audioClips: z.array(audioClipSchema).max(LIMITS.audioClips),
  subtitles: z.array(subtitleSchema).max(LIMITS.subtitles),
  duckMusic: z.boolean(),
});

const legacyProjectSchema = projectSchema
  .omit({ audioClips: true, subtitles: true, duckMusic: true })
  .extend({ schemaVersion: z.literal(1) });

export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Project = z.infer<typeof projectSchema>;
export type AspectRatio = Project["ratio"];
export type ExportResolution = "720p" | "1080p";
export type AudioClip = z.infer<typeof audioClipSchema>;
export type Subtitle = z.infer<typeof subtitleSchema>;

/** Validate source bounds independently so edits do not clone the entire media library. */
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
    asset.kind === "audio" ||
    asset.isOriginalOnly
  )
    throw new Error("A scene references missing or invalid media");
  if (asset.kind === "image" && scene.start !== 0)
    throw new Error("Photos must start at zero");
  if (
    asset.kind === "video" &&
    scene.start + scene.duration > asset.duration + 0.001
  ) {
    throw new Error("The trim extends beyond the source clip");
  }
}

// Time O(scenes + assets), space O(scenes + assets) for schema validation and uniqueness.
/** Parse an untrusted manifest, including relationships that static types cannot express. */
export function parseProject(input: unknown): Project {
  const isLegacy =
    !!input &&
    typeof input === "object" &&
    "schemaVersion" in input &&
    input.schemaVersion === 1;
  const project = projectSchema.parse(
    isLegacy
      ? {
          ...legacyProjectSchema.parse(input),
          schemaVersion: 2,
          audioClips: [],
          subtitles: [],
          duckMusic: false,
        }
      : input,
  );
  const assets = Object.entries(project.assets);
  if (assets.length > LIMITS.assets)
    throw new Error("This project has too many media files");
  let bytes = 0;
  for (const [id, asset] of assets) {
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
  }
  if (bytes > LIMITS.projectBytes)
    throw new Error("This project exceeds the 8 GB media limit");
  const sceneIds = new Set<string>();
  let duration = 0;
  for (const scene of project.scenes) {
    if (sceneIds.has(scene.id))
      throw new Error("Scene identifiers must be unique");
    sceneIds.add(scene.id);
    duration += scene.duration;
    assertSceneMedia(scene, project.assets);
  }
  if (duration > LIMITS.filmSeconds)
    throw new Error("Keep this film within 30 minutes");
  if (project.music && project.assets[project.music.assetId]?.kind !== "audio")
    throw new Error("The soundtrack references missing audio media");
  const soundIds = new Set<string>();
  for (const clip of project.audioClips) {
    const asset = project.assets[clip.assetId];
    if (soundIds.has(clip.id))
      throw new Error("Sound identifiers must be unique");
    soundIds.add(clip.id);
    if (!asset || asset.kind !== "audio")
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
  const subtitleIds = new Set<string>();
  let previousEnd = 0;
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
  return project;
}
