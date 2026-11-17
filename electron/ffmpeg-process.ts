import { spawn } from "node:child_process";

const MAX_DIAGNOSTIC_CHARACTERS = 16000;

export interface ProcessOptions {
  signal: AbortSignal;
  onSeconds?: (seconds: number) => void;
  allowFailure?: boolean;
  cwd?: string;
}

/** Execute a fixed binary with argument arrays, bounded diagnostics and immediate cancellation. */
export function runFfmpeg(
  binary: string,
  arguments_: readonly string[],
  options: ProcessOptions,
): Promise<string> {
  options.signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(
      binary,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-progress",
        "pipe:1",
        "-nostats",
        ...arguments_,
      ],
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        cwd: options.cwd,
      },
    );
    let diagnostics = "";
    let progressBuffer = "";
    const cancel = () => child.kill("SIGTERM");
    options.signal.addEventListener("abort", cancel, { once: true });
    child.stderr.on("data", (chunk: Buffer) => {
      diagnostics = (diagnostics + chunk.toString()).slice(
        -MAX_DIAGNOSTIC_CHARACTERS,
      );
    });
    child.stdout.on("data", (chunk: Buffer) => {
      progressBuffer += chunk.toString();
      let boundary: number;
      while ((boundary = progressBuffer.indexOf("\n")) >= 0) {
        const line = progressBuffer.slice(0, boundary).trim();
        progressBuffer = progressBuffer.slice(boundary + 1);
        if (line.startsWith("out_time_us=")) {
          const microseconds = Number(line.slice(12));
          if (Number.isFinite(microseconds))
            options.onSeconds?.(microseconds / 1_000_000);
        }
      }
    });
    child.once("error", (error) => {
      options.signal.removeEventListener("abort", cancel);
      reject(error);
    });
    child.once("close", (code) => {
      options.signal.removeEventListener("abort", cancel);
      if (options.signal.aborted) reject(new Error("Export cancelled"));
      else if (code === 0 || options.allowFailure) resolve(diagnostics);
      else
        reject(
          new Error(
            `FFmpeg exited with ${code}: ${diagnostics.trim() || "no diagnostic output"}`,
          ),
        );
    });
  });
}
