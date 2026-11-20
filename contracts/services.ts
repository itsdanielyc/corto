import { z } from "zod";
import { identifierSchema, LIMITS } from "./values";
import type { ImportedMedia } from "./platform";
import type { Preferences, Project } from "./project";

/** Only these local, non-destructive operations may reach the native media worker. */
export const mediaOperationSchema = z.strictObject({
  assetId: identifierSchema,
  operation: z.enum([
    "audio",
    "reverse",
    "stabilize",
    "frame",
    "scenes",
    "denoise",
    "normalize",
    "proxy",
  ]),
  start: z
    .number()
    .finite()
    .min(0)
    .max(24 * 3600)
    .default(0),
  duration: z.number().finite().positive().max(LIMITS.filmSeconds).optional(),
  threshold: z.number().finite().min(0.05).max(0.9).default(0.3),
  speed: z.number().finite().min(0.25).max(4).default(1),
  preservePitch: z.boolean().default(true),
});
export type MediaOperation = z.infer<typeof mediaOperationSchema>;
export interface MediaOperationResult {
  media?: ImportedMedia;
  boundaries?: number[];
}

/** One raster travels at a time; its opaque key identifies a validated project-owned layer. */
export interface RenderRaster {
  key: string;
  width: number;
  height: number;
  png: Uint8Array;
}
export interface ProjectVersion {
  id: string;
  savedAt: string;
  name: string;
  sceneCount: number;
}
export type ProjectAction =
  | { operation: "rename"; id: string; name: string }
  | { operation: "duplicate" | "delete"; id: string };
export interface UpdateInformation {
  version: string;
  url: string;
  signed: boolean;
}

/** Optional platform services are capability checked at the UI boundary. */
export interface CreatorServices {
  onProjectOpened?(listener: (project: Project) => void): () => void;
  audioSamples?(
    project: Project,
    request: {
      assetId: string;
      start: number;
      duration: number;
      speed: number;
      preservePitch: boolean;
    },
  ): Promise<Float32Array>;
  importMedia?(file: File): Promise<ImportedMedia>;
  processMedia?(
    project: Project,
    request: MediaOperation,
    signal?: AbortSignal,
  ): Promise<MediaOperationResult>;
  projectAction?(request: ProjectAction): Promise<Project | null>;
  listVersions?(id: string): Promise<ProjectVersion[]>;
  restoreVersion?(id: string, version: string): Promise<Project>;
  loadPreferences?(): Promise<Preferences>;
  savePreferences?(preferences: Preferences): Promise<void>;
  checkForUpdate?(): Promise<UpdateInformation | null>;
}
