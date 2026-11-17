import type { Project, Subtitle } from "../../contracts/project";
import type { CortoPlatform } from "../platform/types";
import { speechWindows } from "./speech-plan";
import { LocalModelSession } from "./client";
import type { ModelProgress } from "./catalogue";

/** Create an editable subtitle draft from small local speech windows, never music-only tracks. */
export async function transcribeFilm(
  project: Project,
  platform: CortoPlatform,
  language: "en" | "es",
  signal: AbortSignal,
  progress: (value: ModelProgress) => void,
): Promise<Subtitle[]> {
  if (!platform.audioSamples)
    throw new Error("This platform cannot prepare local speech audio");
  const windows = speechWindows(project);
  if (!windows.length)
    throw new Error(
      "Add an audible clip or narration before generating captions",
    );
  const cues: Subtitle[] = [];
  const session = new LocalModelSession(signal, progress);
  try {
    for (const [index, window] of windows.entries()) {
      signal.throwIfAborted();
      progress({
        message: `Preparing speech ${index + 1} of ${windows.length}`,
        fraction: index / windows.length,
      });
      const samples = await platform.audioSamples(project, {
        assetId: window.assetId,
        start: window.sourceStart,
        duration: window.duration,
        speed: window.speed,
        preservePitch: window.preservePitch,
      });
      let energy = 0;
      for (const sample of samples) energy += sample * sample;
      if (Math.sqrt(energy / samples.length) < 0.003) continue;
      const result = await session.run({ kind: "speech", samples, language });
      if (!("chunks" in result))
        throw new Error("The caption model returned no text");
      for (const chunk of result.chunks) {
        const start = Math.max(window.start, window.start + chunk.timestamp[0]);
        const end = Math.min(
          window.start + window.duration,
          window.start + (chunk.timestamp[1] ?? window.duration),
        );
        const text = chunk.text.trim();
        if (!text || end <= start) continue;
        cues.push({
          id: crypto.randomUUID(),
          start,
          end,
          text: text.slice(0, 1000),
        });
      }
    }
    return cues.sort((a, b) => a.start - b.start);
  } finally {
    session.dispose();
  }
}
