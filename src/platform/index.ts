import type {
  NativeBridge,
  MovieRequest,
  ExportProgress,
  MovieResult,
} from "../../contracts/platform";
import type { MediaAsset, Project } from "../../contracts/project";
import { BrowserProjectRepository } from "./browser-repository";
import type { CortoPlatform } from "./types";

class NativePlatform implements CortoPlatform {
  readonly kind = "native" as const;
  constructor(private readonly bridge: NativeBridge) {}
  loadProject(): Promise<Project | null> {
    return this.bridge.loadProject();
  }
  saveProject(project: Project): Promise<void> {
    return this.bridge.saveProject(project);
  }
  listProjects() {
    return this.bridge.listProjects();
  }
  openProject(id: string, recover = false) {
    return this.bridge.openProject(id, recover);
  }
  importPhoneVideo(file: File) {
    return this.bridge.importPhoneVideo(file);
  }
  putAsset(asset: MediaAsset, file: File): Promise<void> {
    return this.bridge.putAsset(asset, file);
  }
  async assetUrl(id: string): Promise<string> {
    return this.bridge.assetUrl(id);
  }
  openPortable(): Promise<Project | null> {
    return this.bridge.openPortable();
  }
  savePortable(project: Project): Promise<boolean> {
    return this.bridge.savePortable(project);
  }
  revealExport(): Promise<void> {
    return this.bridge.revealExport();
  }
  releaseMediaUrls(): void {
    /* The native protocol owns no browser object URLs. */
  }
  async renderMovie(
    request: MovieRequest,
    progress: (value: ExportProgress) => void,
    signal: AbortSignal,
  ): Promise<MovieResult | null> {
    signal.throwIfAborted();
    const unsubscribe = this.bridge.onExportProgress(progress);
    const cancel = () => {
      void this.bridge.cancelExport();
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      return await this.bridge.exportMovie(request);
    } finally {
      unsubscribe();
      signal.removeEventListener("abort", cancel);
    }
  }
}

class WebPlatform extends BrowserProjectRepository implements CortoPlatform {
  constructor(readonly kind: "web" | "mock") {
    super();
  }
  override async openPortable(file?: File): Promise<Project | null> {
    return file ? super.openPortable(file) : null;
  }
  async revealExport(): Promise<void> {
    /* Browser downloads are managed by the browser. */
  }
  async renderMovie(
    request: MovieRequest,
    progress: (value: ExportProgress) => void,
    signal: AbortSignal,
    surface?: HTMLCanvasElement,
  ): Promise<MovieResult> {
    const { renderBrowserMovie } = await import("../export/browser");
    return renderBrowserMovie(
      request,
      (id) => this.assetUrl(id),
      progress,
      signal,
      surface,
    );
  }
}

/** The mock label is a test-build flag; production web uses its real IndexedDB implementation. */
export function createPlatform(): CortoPlatform {
  if (window.electronBridge) return new NativePlatform(window.electronBridge);
  return new WebPlatform(
    import.meta.env.VITE_CORTO_MOCK === "1" ? "mock" : "web",
  );
}
