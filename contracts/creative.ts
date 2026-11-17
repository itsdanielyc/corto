import { z } from "zod";
import {
  colourSchema,
  DEFAULT_PHOTO_SECONDS,
  fontSchema,
  identifierSchema,
  LIMITS,
  outputFormatSchema,
  resolutionSchema,
  transitionSchema,
} from "./values";

const unit = () => z.number().finite().min(0).max(1);
export const transformSchema = z.strictObject({
  rotation: z
    .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
    .default(0),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  focusX: unit().default(0.5),
  focusY: unit().default(0.5),
  zoom: z.number().finite().min(1).max(6).default(1),
  endFocusX: unit().default(0.5),
  endFocusY: unit().default(0.5),
  endZoom: z.number().finite().min(1).max(6).default(1),
  motion: z
    .enum([
      "none",
      "zoom-in",
      "zoom-out",
      "pan-left",
      "pan-right",
      "pan-up",
      "pan-down",
      "custom",
    ])
    .default("none"),
});
export const adjustmentSchema = z.strictObject({
  brightness: z.number().finite().min(-1).max(1).default(0),
  contrast: z.number().finite().min(-0.9).max(1).default(0),
  saturation: z.number().finite().min(-1).max(1).default(0),
  warmth: z.number().finite().min(-1).max(1).default(0),
  look: z
    .enum(["none", "mono", "sepia", "warm", "cool", "vivid", "faded"])
    .default("none"),
  lutAssetId: identifierSchema.optional(),
});
export const textItemSchema = z.strictObject({
  id: identifierSchema,
  text: z.string().max(LIMITS.captionCharacters),
  start: z.number().finite().min(0).max(LIMITS.sceneSeconds).default(0),
  end: z
    .number()
    .finite()
    .positive()
    .max(LIMITS.sceneSeconds)
    .nullable()
    .default(null),
  font: fontSchema.default("sans"),
  size: z.number().finite().min(0.01).max(0.4).default(0.07),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  colour: colourSchema.default("#ffffff"),
  outline: colourSchema.default("#151517"),
  outlineWidth: z.number().finite().min(0).max(0.02).default(0),
  shadow: z.boolean().default(true),
  boxColour: colourSchema.default("#151517"),
  boxOpacity: unit().default(0),
  align: z.enum(["left", "center", "right"]).default("center"),
  x: unit().default(0.5),
  y: unit().default(0.5),
  width: z.number().finite().min(0.1).max(1).default(0.84),
  animation: z
    .enum(["none", "fade", "slide", "typewriter", "pop", "credits"])
    .default("none"),
  animationSeconds: z.number().finite().min(0.1).max(10).default(0.5),
});
export const visualLayerSchema = z.strictObject({
  id: identifierSchema,
  kind: z.enum(["media", "shape", "sticker"]),
  assetId: identifierSchema.nullable().default(null),
  shape: z
    .enum([
      "rectangle",
      "ellipse",
      "arrow",
      "line",
      "star",
      "heart",
      "balloon",
      "confetti",
      "sparkle",
      "flower",
    ])
    .default("rectangle"),
  colour: colourSchema.default("#ffffff"),
  stroke: colourSchema.default("#151517"),
  strokeWidth: z.number().finite().min(0).max(0.03).default(0),
  x: z.number().finite().min(-1).max(2).default(0.75),
  y: z.number().finite().min(-1).max(2).default(0.25),
  width: z.number().finite().min(0.02).max(2).default(0.3),
  height: z.number().finite().min(0.02).max(2).default(0.3),
  endX: z.number().finite().min(-1).max(2).nullable().default(null),
  endY: z.number().finite().min(-1).max(2).nullable().default(null),
  endScale: z.number().finite().min(0.1).max(6).default(1),
  opacity: unit().default(1),
  endOpacity: unit().nullable().default(null),
  rotation: z.number().finite().min(-360).max(360).default(0),
  volume: z.number().finite().min(0).max(4).default(0),
  fit: z.enum(["cover", "contain"]).default("contain"),
  keyColour: colourSchema.nullable().default(null),
  keyTolerance: z.number().finite().min(0.01).max(0.8).default(0.15),
  start: z.number().finite().min(0).max(LIMITS.sceneSeconds).default(0),
  end: z
    .number()
    .finite()
    .positive()
    .max(LIMITS.sceneSeconds)
    .nullable()
    .default(null),
  sourceStart: z
    .number()
    .finite()
    .min(0)
    .max(24 * 3600)
    .default(0),
  loop: z.boolean().default(true),
});
export const backdropSchema = z.strictObject({
  kind: z.enum(["solid", "gradient", "blur", "photo"]).default("solid"),
  secondColour: colourSchema.default("#6f737c"),
  angle: z.number().finite().min(0).max(360).default(135),
  assetId: identifierSchema.nullable().default(null),
});
export const subtitleStyleSchema = z.strictObject({
  font: fontSchema.default("sans"),
  size: z.number().finite().min(0.02).max(0.12).default(0.048),
  colour: colourSchema.default("#ffffff"),
  boxColour: colourSchema.default("#151517"),
  boxOpacity: unit().default(0.8),
  position: z.enum(["top", "middle", "bottom"]).default("bottom"),
});
export const projectDefaultsSchema = z.strictObject({
  photoSeconds: z
    .number()
    .finite()
    .min(0.25)
    .max(120)
    .default(DEFAULT_PHOTO_SECONDS),
  fit: z.enum(["cover", "contain"]).default("cover"),
  transition: transitionSchema.default("cut"),
  transitionSeconds: z.number().finite().min(0).max(5).default(0.5),
  titleStyle: z.enum(["classic", "modern", "minimal"]).default("classic"),
  background: colourSchema.default("#151517"),
});
export const outputSettingsSchema = z.strictObject({
  resolution: resolutionSchema.default("1080p"),
  fps: z
    .union([
      z.literal(24),
      z.literal(25),
      z.literal(30),
      z.literal(60),
      z.literal("source"),
    ])
    .default(30),
  format: outputFormatSchema.default("mp4"),
  quality: z.number().int().min(0).max(100).default(70),
  preset: z
    .enum([
      "tv",
      "phone",
      "small",
      "youtube",
      "instagram",
      "whatsapp",
      "email",
      "custom",
    ])
    .default("tv"),
  encoder: z.enum(["auto", "software", "hardware"]).default("auto"),
  threads: z.number().int().min(0).max(16).default(0),
});
export const preferencesSchema = z.strictObject({
  locale: z.enum(["en", "es"]).default("en"),
  defaults: projectDefaultsSchema.prefault({}),
  timeline: z.boolean().default(false),
  timelineZoom: z.number().finite().min(4).max(200).default(24),
  proxyEditing: z.boolean().default(false),
  checkUpdates: z.boolean().default(false),
});
export type Transform = z.infer<typeof transformSchema>;
export type Adjustments = z.infer<typeof adjustmentSchema>;
export type TextItem = z.infer<typeof textItemSchema>;
export type VisualLayer = z.infer<typeof visualLayerSchema>;
export type ProjectDefaults = z.infer<typeof projectDefaultsSchema>;
export type OutputSettings = z.infer<typeof outputSettingsSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type SubtitleStyle = z.infer<typeof subtitleStyleSchema>;
