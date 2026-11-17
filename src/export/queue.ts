import type {
  ExportProgress,
  MovieRequest,
  MovieResult,
} from "../../contracts/platform";
import { parseProject } from "../../contracts/project";

const MAX_PENDING_JOBS = 5;
const RETAINED_JOBS = 10;
export interface MovieJobState {
  id: string;
  name: string;
  status: "queued" | "running" | "done" | "cancelled" | "failed";
  progress: ExportProgress;
  result: MovieResult | null;
  error: string | null;
}
type Renderer = (
  request: MovieRequest,
  progress: (value: ExportProgress) => void,
  signal: AbortSignal,
  surface?: HTMLCanvasElement,
) => Promise<MovieResult | null>;
interface PendingJob {
  state: MovieJobState;
  request: MovieRequest | null;
  controller: AbortController;
  surface?: HTMLCanvasElement;
  resolve: (result: MovieResult | null) => void;
  reject: (error: unknown) => void;
  detach: () => void;
  progress: (value: ExportProgress) => void;
}

/** Serial immutable jobs keep native destinations, source snapshots and cancellation independent of current edits. */
export class ExportQueue {
  private readonly jobs: PendingJob[] = [];
  private readonly listeners = new Set<() => void>();
  private snapshot: readonly MovieJobState[] = [];
  private active = false;
  constructor(
    private readonly renderer: Renderer,
    private readonly dispose: (
      request: MovieRequest,
    ) => Promise<void> = async () => undefined,
  ) {}
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = (): readonly MovieJobState[] => this.snapshot;
  private notify(): void {
    this.snapshot = this.jobs.map((job) => ({
      ...job.state,
      progress: { ...job.state.progress },
    }));
    for (const listener of this.listeners) listener();
  }
  render: Renderer = async (request, progress, signal, surface) => {
    signal.throwIfAborted();
    if (
      this.jobs.filter((job) =>
        ["running", "queued"].includes(job.state.status),
      ).length >= MAX_PENDING_JOBS
    )
      throw new Error(
        "The queue holds five exports. Wait for one to finish before adding another.",
      );
    const snapshot = immutableMovieRequest(request);
    return new Promise<MovieResult | null>((resolve, reject) => {
      const id = crypto.randomUUID();
      const controller = new AbortController();
      const cancel = () => this.cancel(id);
      signal.addEventListener("abort", cancel, { once: true });
      this.jobs.push({
        state: {
          id,
          name: snapshot.project.name,
          status: "queued",
          progress: { fraction: 0, message: "Waiting in the export queue" },
          result: null,
          error: null,
        },
        request: snapshot,
        controller,
        surface,
        resolve,
        reject,
        detach: () => signal.removeEventListener("abort", cancel),
        progress,
      });
      while (
        this.jobs.length > RETAINED_JOBS &&
        !["queued", "running"].includes(this.jobs[0].state.status)
      )
        this.jobs.shift();
      this.notify();
      void this.pump();
    });
  };
  cancel(id: string): void {
    const job = this.jobs.find((job) => job.state.id === id);
    if (!job || !["queued", "running"].includes(job.state.status)) return;
    job.controller.abort(new Error("Export cancelled"));
    if (job.state.status === "queued") {
      const request = job.request;
      job.request = null;
      job.state.status = "cancelled";
      job.detach();
      if (request) void this.dispose(request).catch(() => undefined);
      job.reject(job.controller.signal.reason);
      this.notify();
    }
  }
  private async pump(): Promise<void> {
    if (this.active) return;
    const job = this.jobs.find(
      (job) => job.state.status === "queued" && job.request,
    );
    if (!job?.request) return;
    this.active = true;
    const request = job.request;
    job.state.status = "running";
    this.notify();
    try {
      const result = await this.renderer(
        request,
        (value) => {
          job.state.progress = value;
          job.progress(value);
          this.notify();
        },
        job.controller.signal,
        job.surface,
      );
      job.controller.signal.throwIfAborted();
      job.state.result = result;
      job.state.status = result ? "done" : "cancelled";
      job.resolve(result);
    } catch (error) {
      job.state.status = job.controller.signal.aborted ? "cancelled" : "failed";
      job.state.error = job.controller.signal.aborted
        ? null
        : error instanceof Error
          ? error.message
          : "Export failed";
      job.reject(error);
    } finally {
      job.detach();
      job.request = null;
      job.surface = undefined;
      await this.dispose(request).catch(() => undefined);
      this.active = false;
      this.notify();
      void this.pump();
    }
  }
  cancelAll(): void {
    for (const job of this.jobs) this.cancel(job.state.id);
  }
}

/** Capture a validated copy without cloning DOM surfaces or retaining mutable editor objects. */
export function immutableMovieRequest(request: MovieRequest): MovieRequest {
  return {
    ...structuredClone(request),
    project: parseProject(request.project),
  };
}
