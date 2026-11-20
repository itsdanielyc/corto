import type {
  ExportProgress,
  MovieRequest,
  MovieResult,
  ProjectRepository,
  ImportedMedia,
  ThemeChoice,
  WindowFrame,
} from "../../contracts/platform";
import type { MediaAsset, Project } from "../../contracts/project";
import type { CreatorServices } from "../../contracts/services";

/** Account-free platform effects used by the editor; native paths and raw IPC stay private. */
export interface CortoPlatform extends ProjectRepository, CreatorServices {
  readonly kind: "native" | "web" | "mock";
  /** Which title-bar layout the window frame needs (traffic lights, caption buttons, none). */
  readonly windowFrame: WindowFrame;
  /** Follows the chosen appearance in native window controls; no-op on the web. */
  setNativeTheme?(theme: ThemeChoice): Promise<void>;
  putAsset(asset: MediaAsset, file: File): Promise<void>;
  importPhoneVideo?(file: File): Promise<ImportedMedia>;
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
  prepareExport?(request: MovieRequest): Promise<MovieRequest | null>;
  disposeExport?(request: MovieRequest): Promise<void>;
}
