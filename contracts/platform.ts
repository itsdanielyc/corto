import type { ExportResolution, MediaAsset, Project } from "./project";
import type { CreatorServices, RenderRaster } from "./services";

/** The persistence seam exercised by both the labelled mock and real file storage. */
export interface ProjectRepository {
  loadProject(): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  listProjects(): Promise<ProjectSummary[]>;
  openProject(id: string, recover?: boolean): Promise<Project>;
}

/** Small catalogue entries keep project-home reads independent of original media size. */
export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  sceneCount: number;
  duration: number;
  thumbnail: MediaAsset | null;
  hasRecovery: boolean;
  unavailableReason?: string;
}
export interface SavedProject {
  project: Project;
  updatedAt: string;
  previous: Project | null;
}
export interface ImportedMedia {
  asset: MediaAsset;
  original?: MediaAsset;
}

export interface PlatformDetails {
  os: string;
  arch: string;
  electron: string;
  packaged: boolean;
}
export interface CaptionOverlay {
  sceneId: string;
  png: Uint8Array;
}
export interface MovieRequest {
  project: Project;
  resolution: ExportResolution;
  overlays: CaptionOverlay[];
  subtitleOverlays?: { cueId: string; png: Uint8Array }[];
  preset?: "tv" | "phone" | "small";
  sample?: boolean;
  range?: { start: number; end: number };
  renderAssetsToken?: string;
  destinationToken?: string;
}
export interface ExportProgress {
  fraction: number;
  message: string;
}
export interface MovieResult {
  fileName: string;
  format: "MP4" | "WebM" | "GIF" | "M4A" | "WAV";
  location: "file" | "download";
}

/** Narrow, typed preload API. The renderer never receives raw IPC or filesystem primitives. */
export interface NativeBridge extends ProjectRepository, CreatorServices {
  platformInfo(): Promise<PlatformDetails>;
  putAsset(asset: MediaAsset, file: File): Promise<void>;
  importPhoneVideo(file: File): Promise<ImportedMedia>;
  assetUrl(id: string): string;
  openPortable(): Promise<Project | null>;
  savePortable(project: Project): Promise<boolean>;
  exportMovie(request: MovieRequest): Promise<MovieResult | null>;
  cancelExport(): Promise<void>;
  cancelMedia?(): Promise<void>;
  onExportProgress(listener: (progress: ExportProgress) => void): () => void;
  revealExport(): Promise<void>;
  beginRenderAssets?(project: Project, resolution: ExportResolution): Promise<string>;
  stageRenderAsset?(token: string, raster: RenderRaster): Promise<void>;
  releaseRenderAssets?(token: string): Promise<void>;
  chooseExportDestination?(project: Project, sample?: boolean): Promise<string | null>;
  releaseExportDestination?(token: string): Promise<void>;
}

export const nativeChannels = {
  loadProject: "corto:load-project",
  saveProject: "corto:save-project",
  listProjects: "corto:list-projects",
  openProject: "corto:open-project",
  importPhoneVideo: "corto:import-phone-video",
  putAsset: "corto:put-asset",
  openPortable: "corto:open-portable",
  savePortable: "corto:save-portable",
  exportMovie: "corto:export-movie",
  cancelExport: "corto:cancel-export",
  exportProgress: "corto:export-progress",
  revealExport: "corto:reveal-export",
  beginRenderAssets: "corto:begin-render-assets",
  stageRenderAsset: "corto:stage-render-asset",
  releaseRenderAssets: "corto:release-render-assets",
  importMedia: "corto:import-media",
  processMedia: "corto:process-media",
  cancelMedia: "corto:cancel-media",
  projectAction: "corto:project-action",
  listVersions: "corto:list-versions",
  restoreVersion: "corto:restore-version",
  loadPreferences: "corto:load-preferences",
  savePreferences: "corto:save-preferences",
  checkForUpdate: "corto:check-for-update",
  projectOpened: "corto:project-opened",
  audioSamples: "corto:audio-samples",
  chooseExportDestination: "corto:choose-export-destination",
  releaseExportDestination: "corto:release-export-destination",
} as const;
