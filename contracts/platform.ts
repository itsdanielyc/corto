import type { ExportResolution, MediaAsset, Project } from "./project";

/** The persistence seam exercised by both the labelled mock and real file storage. */
export interface ProjectRepository {
  loadProject(): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
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
}
export interface ExportProgress {
  fraction: number;
  message: string;
}
export interface MovieResult {
  fileName: string;
  format: "MP4" | "WebM";
  location: "file" | "download";
}

/** Narrow, typed preload API. The renderer never receives raw IPC or filesystem primitives. */
export interface NativeBridge extends ProjectRepository {
  platformInfo(): Promise<PlatformDetails>;
  putAsset(asset: MediaAsset, file: File): Promise<void>;
  assetUrl(id: string): string;
  openPortable(): Promise<Project | null>;
  savePortable(project: Project): Promise<boolean>;
  exportMovie(request: MovieRequest): Promise<MovieResult | null>;
  cancelExport(): Promise<void>;
  onExportProgress(listener: (progress: ExportProgress) => void): () => void;
  revealExport(): Promise<void>;
}

export const nativeChannels = {
  loadProject: "corto:load-project",
  saveProject: "corto:save-project",
  putAsset: "corto:put-asset",
  openPortable: "corto:open-portable",
  savePortable: "corto:save-portable",
  exportMovie: "corto:export-movie",
  cancelExport: "corto:cancel-export",
  exportProgress: "corto:export-progress",
  revealExport: "corto:reveal-export",
} as const;
