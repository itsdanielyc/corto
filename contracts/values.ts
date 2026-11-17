import { z } from "zod";

/** Limits bound untrusted manifests, history and active decoder/renderer work. */
export const LIMITS = {
  scenes: 1000,
  assets: 2500,
  assetBytes: 8 * 1024 ** 3,
  projectBytes: 64 * 1024 ** 3,
  filmSeconds: 3 * 60 * 60,
  sceneSeconds: 60 * 60,
  minimumSceneSeconds: 0.25,
  manifestBytes: 16 * 1024 ** 2,
  captionCharacters: 8000,
  history: 100,
  audioClips: 128,
  subtitles: 10000,
  textItems: 24,
  visualLayers: 8,
  markers: 500,
} as const;
export const DEFAULT_PHOTO_SECONDS = 5;
export const DEFAULT_PROJECT_NAME = "Untitled film";
export const EXPORT_FPS = 30;
export const FADE_SECONDS = 0.3;
export const identifierSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,80}$/, "Invalid media identifier")
  .refine(
    (value) => !Object.hasOwn(Object.prototype, value),
    "Reserved media identifier",
  );
export const colourSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Choose a six-digit colour");
export const fontSchema = z.enum(["serif", "sans", "mono", "rounded"]);
export const resolutionSchema = z.enum(["720p", "1080p", "2160p"]);
export const ratioSchema = z.enum([
  "landscape",
  "portrait",
  "square",
  "classic",
  "feed",
  "cinema",
]);
export const transitionSchema = z.enum([
  "cut",
  "fade",
  "dissolve",
  "fade-white",
  "wipe-left",
  "wipe-right",
  "slide-left",
  "slide-right",
  "push-up",
  "zoom",
  "blur",
]);
export const outputFormatSchema = z.enum(["mp4", "gif", "m4a", "wav"]);
