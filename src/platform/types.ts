import type {
  ExportProgress,
  MovieRequest,
  MovieResult,
  ProjectRepository,
} from "../../contracts/platform";
import type { MediaAsset, Project } from "../../contracts/project";

/** Account-free platform effects used by the editor; native paths and raw IPC stay private. */
export interface CortoPlatform extends ProjectRepository {
  readonly kind: "native" | "web" | "mock";
  putAsset(asset: MediaAsset, file: File): Promise<void>;
  assetUrl(id: string): Promise<string>;
  openPortable(file?: File): Promise<Project | null>;
  savePortable(project: Project): Promise<boolean>;
  renderMovie(
    request: MovieRequest,
    progress: (value: ExportProgress) => void,
    signal: AbortSignal,
    surface?: HTMLCanvasElement,
  ): Promise<MovieResult | null>;
  revealExport(): Promise<void>;
  releaseMediaUrls(): void;
}
