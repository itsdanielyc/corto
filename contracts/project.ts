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
} as const;

export const DEFAULT_PHOTO_SECONDS = 5;
export const EXPORT_FPS = 30;
export const FADE_SECONDS = 0.3;
export const identifierSchema = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/, "Invalid media identifier");

const imageMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"] as const;
const videoMimes = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "video/ogg"] as const;
const audioMimes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/ogg", "audio/flac", "audio/x-flac", "audio/mp4", "audio/aac", "audio/webm"] as const;

export const mediaAssetSchema = z.strictObject({
  id: identifierSchema,
  name: z.string().min(1).max(255),
  kind: z.enum(["image", "video", "audio"]),
  mime: z.string().max(80),
  size: z.number().int().positive().max(LIMITS.assetBytes),
  duration: z.number().finite().min(0).max(24 * 60 * 60),
  width: z.number().int().min(0).max(32768),
  height: z.number().int().min(0).max(32768),
}).superRefine((asset, context) => {
  const allowed: readonly string[] = asset.kind === "image" ? imageMimes : asset.kind === "video" ? videoMimes : audioMimes;
  if (!allowed.includes(asset.mime)) context.addIssue({ code: "custom", message: "This media format is not supported" });
  if (asset.kind !== "image" && asset.duration <= 0) context.addIssue({ code: "custom", message: "Media has no playable duration" });
  if (asset.kind !== "audio" && (asset.width <= 0 || asset.height <= 0)) context.addIssue({ code: "custom", message: "Media has no visible dimensions" });
});

export const sceneSchema = z.strictObject({
  id: identifierSchema,
  assetId: identifierSchema.nullable(),
  duration: z.number().finite().min(LIMITS.minimumSceneSeconds).max(LIMITS.sceneSeconds),
  start: z.number().finite().min(0).max(24 * 60 * 60),
  caption: z.string().max(LIMITS.captionCharacters),
  captionStyle: z.enum(["classic", "modern", "minimal"]),
  captionPosition: z.enum(["center", "bottom"]),
  fit: z.enum(["cover", "contain"]),
  transition: z.enum(["cut", "fade"]),
  volume: z.number().finite().min(0).max(1),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const projectSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: identifierSchema,
  name: z.string().trim().min(1).max(80),
  ratio: z.enum(["landscape", "portrait", "square"]),
  assets: z.record(identifierSchema, mediaAssetSchema),
  scenes: z.array(sceneSchema).max(LIMITS.scenes),
  music: z.strictObject({ assetId: identifierSchema, volume: z.number().finite().min(0).max(1), loop: z.boolean() }).nullable(),
});

export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Project = z.infer<typeof projectSchema>;
export type AspectRatio = Project["ratio"];
export type ExportResolution = "720p" | "1080p";

/** Validate source bounds independently so edits do not clone the entire media library. */
export function assertSceneMedia(scene: Scene, assets: Project["assets"]): void {
  if (scene.assetId === null) {
    if (scene.start !== 0) throw new Error("Title cards must start at zero");
    return;
  }
  const asset = assets[scene.assetId];
  if (!asset || asset.kind === "audio") throw new Error("A scene references missing or invalid media");
  if (asset.kind === "image" && scene.start !== 0) throw new Error("Photos must start at zero");
  if (asset.kind === "video" && scene.start + scene.duration > asset.duration + 0.001) {
    throw new Error("The trim extends beyond the source clip");
  }
}

// Time O(scenes + assets), space O(scenes + assets) for schema validation and uniqueness.
/** Parse an untrusted manifest, including relationships that static types cannot express. */
export function parseProject(input: unknown): Project {
  const project = projectSchema.parse(input);
  const assets = Object.entries(project.assets);
  if (assets.length > LIMITS.assets) throw new Error("This project has too many media files");
  let bytes = 0;
  for (const [id, asset] of assets) {
    if (id !== asset.id) throw new Error("Media identifiers do not match");
    bytes += asset.size;
  }
  if (bytes > LIMITS.projectBytes) throw new Error("This project exceeds the 8 GB media limit");
  const sceneIds = new Set<string>();
  let duration = 0;
  for (const scene of project.scenes) {
    if (sceneIds.has(scene.id)) throw new Error("Scene identifiers must be unique");
    sceneIds.add(scene.id);
    duration += scene.duration;
    assertSceneMedia(scene, project.assets);
  }
  if (duration > LIMITS.filmSeconds) throw new Error("Keep this film within 30 minutes");
  if (project.music && project.assets[project.music.assetId]?.kind !== "audio") throw new Error("The soundtrack references missing audio media");
  return project;
}
