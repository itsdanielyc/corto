import type {
  NativeBridge,
  MovieRequest,
  ExportProgress,
  MovieResult,
} from "../../contracts/platform";
import type { MediaAsset, Project } from "../../contracts/project";
import { BrowserProjectRepository } from "./browser-repository";
import type { CortoPlatform } from "./types";
import { projectRasters } from "../preview/rasters";
import { scopedRasterProject } from "../export/raster-scope";
import type { MediaOperation, ProjectAction } from "../../contracts/services";
import { preferencesSchema } from "../../contracts/creative";
import type { Preferences } from "../../contracts/project";
import packageInfo from "../../package.json";
import { checkPublishedUpdate } from "./updates";

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
  projectAction(request: ProjectAction) {
    if (!this.bridge.projectAction)
      throw new Error("Project tools need a newer desktop build");
    return this.bridge.projectAction(request);
  }
  listVersions(id: string) {
    return this.bridge.listVersions?.(id) ?? Promise.resolve([]);
  }
  restoreVersion(id: string, version: string) {
    if (!this.bridge.restoreVersion)
      throw new Error("Version history needs a newer desktop build");
    return this.bridge.restoreVersion(id, version);
  }
  loadPreferences() {
    return (
      this.bridge.loadPreferences?.() ??
      Promise.resolve(preferencesSchema.parse({}))
    );
  }
  savePreferences(preferences: Preferences) {
    return this.bridge.savePreferences?.(preferences) ?? Promise.resolve();
  }
  onProjectOpened(listener: (project: Project) => void) {
    return this.bridge.onProjectOpened?.(listener) ?? (() => undefined);
  }
  checkForUpdate() {
    return this.bridge.checkForUpdate?.() ?? Promise.resolve(null);
  }
  importPhoneVideo(file: File) {
    return this.bridge.importPhoneVideo(file);
  }
  importMedia(file: File) {
    if (!this.bridge.importMedia) return this.importPhoneVideo(file);
    return this.bridge.importMedia(file);
  }
  processMedia(
    project: Project,
    request: MediaOperation,
    signal?: AbortSignal,
  ) {
    if (!this.bridge.processMedia)
      throw new Error("Media tools need a newer desktop build");
    signal?.throwIfAborted();
    const cancel = () => {
      void this.bridge.cancelMedia?.();
    };
    signal?.addEventListener("abort", cancel, { once: true });
    return this.bridge
      .processMedia(project, request)
      .finally(() => signal?.removeEventListener("abort", cancel));
  }
  audioSamples(
    project: Project,
    request: {
      assetId: string;
      start: number;
      duration: number;
      speed: number;
      preservePitch: boolean;
    },
  ) {
    if (!this.bridge.audioSamples)
      throw new Error("Offline captions need a newer desktop build");
    return this.bridge.audioSamples(project, request);
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
  async prepareExport(request: MovieRequest): Promise<MovieRequest | null> {
    if (!this.bridge.chooseExportDestination) return request;
    const destinationToken = await this.bridge.chooseExportDestination(
      request.project,
      request.sample,
    );
    return destinationToken ? { ...request, destinationToken } : null;
  }
  async disposeExport(request: MovieRequest): Promise<void> {
    if (request.destinationToken)
      await this.bridge.releaseExportDestination?.(request.destinationToken);
  }
  async renderMovie(
    request: MovieRequest,
    progress: (value: ExportProgress) => void,
    signal: AbortSignal,
  ): Promise<MovieResult | null> {
    signal.throwIfAborted();
    const unsubscribe = this.bridge.onExportProgress(progress);
    let token: string | undefined;
    const cancel = () => {
      void this.bridge.cancelExport();
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      if (
        !["m4a", "wav"].includes(request.project.output.format) &&
        this.bridge.beginRenderAssets &&
        this.bridge.stageRenderAsset
      ) {
        token = await this.bridge.beginRenderAssets(
          request.project,
          request.resolution,
        );
        for await (const raster of projectRasters(
          scopedRasterProject(request),
          request.resolution,
          signal,
        )) {
          signal.throwIfAborted();
          await this.bridge.stageRenderAsset(token, raster);
        }
      }
      signal.throwIfAborted();
      return await this.bridge.exportMovie({
        ...request,
        overlays: token ? [] : request.overlays,
        subtitleOverlays: token ? [] : request.subtitleOverlays,
        renderAssetsToken: token,
      });
    } finally {
      unsubscribe();
      signal.removeEventListener("abort", cancel);
      if (token) await this.bridge.releaseRenderAssets?.(token);
    }
  }
}

class WebPlatform extends BrowserProjectRepository implements CortoPlatform {
  constructor(readonly kind: "web" | "mock") {
    super();
  }
  checkForUpdate() {
    return checkPublishedUpdate(packageInfo.version);
  }
  async processMedia(
    project: Project,
    request: MediaOperation,
    signal?: AbortSignal,
  ) {
    const { processBrowserMedia } = await import("../media/browser-jobs");
    return processBrowserMedia(this, project, request, signal);
  }
  async audioSamples(
    project: Project,
    request: {
      assetId: string;
      start: number;
      duration: number;
      speed: number;
      preservePitch: boolean;
    },
  ) {
    const { browserAudioSamples } = await import("../media/browser-jobs");
    return browserAudioSamples(this, project, request);
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
    const urls = new Map<string, string>();
    const resolve = async (id: string) => {
      const cached = urls.get(id);
      if (cached) return cached;
      const url = URL.createObjectURL(await this.assetBlob(id));
      urls.set(id, url);
      return url;
    };
    try {
      return await renderBrowserMovie(
        request,
        resolve,
        progress,
        signal,
        surface,
      );
    } finally {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    }
  }
}

/** The mock label is a test-build flag; production web uses its real IndexedDB implementation. */
export function createPlatform(): CortoPlatform {
  if (window.electronBridge) return new NativePlatform(window.electronBridge);
  return new WebPlatform(
    import.meta.env.VITE_CORTO_MOCK === "1" ? "mock" : "web",
  );
}
