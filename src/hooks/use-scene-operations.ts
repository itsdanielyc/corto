import { useEffect, useRef, useState } from "react";
import type { MediaOperation } from "../../contracts/services";
import {
  audioClipSchema,
  parseProject,
  type Project,
  type Scene,
} from "../../contracts/project";
import { addAsset, createScene, splitScene } from "../domain/project";
import { insertScenes } from "../domain/editing";
import { buildTimeline, frameDimensions } from "../domain/timeline";
import type { CortoPlatform } from "../platform/types";
import { CompositionPlayer } from "../preview/composition-player";
import { renderProjectFrame } from "../preview/composite";
import { downloadBlob, projectFileName } from "../platform/browser-repository";
import { sliceScene } from "../domain/scene-slice";
import { cameraPose } from "../domain/composition";

/**
 * Media operations on the selected scene (speed copies, reverse, stabilise,
 * scene detection, audio detach, freeze frame, proxies) and composed-frame
 * export. The scene's moment is taken from the editor playhead.
 */
export function useSceneOperations({
  project,
  scene,
  platform,
  time,
  onProject,
}: {
  project: Project;
  scene: Scene;
  platform: CortoPlatform;
  time: number;
  onProject: (update: (project: Project) => Project) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState("");
  const cancel = useRef<AbortController | null>(null);
  const asset = scene.assetId ? project.assets[scene.assetId] : null;
  const entry = buildTimeline(project.scenes).find(
    (candidate) => candidate.scene.id === scene.id,
  ) ?? { scene, start: 0 };
  const localTime = Math.max(
    0,
    Math.min(scene.duration - 0.001, time - entry.start),
  );
  const frameTime = entry.start + localTime;
  useEffect(() => () => cancel.current?.abort(), []);
  useEffect(() => setOperationError(""), [scene.id]);
  const saveFrame = async () => {
    const player = new CompositionPlayer(project, (id) =>
      platform.assetUrl(id),
    );
    const controller = new AbortController();
    try {
      const media = await player.prepare(frameTime, controller.signal);
      const output = document.createElement("canvas");
      Object.assign(
        output,
        frameDimensions(project.ratio, project.output.resolution),
      );
      renderProjectFrame(output.getContext("2d")!, project, frameTime, media);
      const blob = await new Promise<Blob | null>((resolve) =>
        output.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("This frame could not be saved");
      downloadBlob(blob, `${projectFileName(project.name)}-frame.png`);
    } finally {
      player.dispose();
    }
  };
  const process = async (operation: MediaOperation["operation"]) => {
    if (!asset || !platform.processMedia)
      throw new Error("This media tool is unavailable on this platform");
    const controller = new AbortController();
    cancel.current = controller;
    setOperationError("");
    setBusy(true);
    try {
      const start =
        operation === "proxy"
          ? 0
          : operation === "frame"
            ? scene.start + localTime * scene.speed
            : scene.start;
      const duration =
        operation === "proxy"
          ? asset.duration
          : operation === "frame"
            ? undefined
            : scene.duration * scene.speed;
      const result = await platform.processMedia(
        project,
        {
          assetId: asset.id,
          operation,
          start,
          duration,
          threshold: 0.3,
          speed: scene.speed,
          preservePitch: scene.preservePitch,
        },
        controller.signal,
      );
      controller.signal.throwIfAborted();
      if (result.boundaries?.length) {
        // Only the first/last cut can clamp neighbouring overlaps; reuse the manual split's timing guards.
        for (const boundary of new Set([
          result.boundaries[0],
          result.boundaries.at(-1)!,
        ]))
          splitScene(project, scene.id, (boundary - scene.start) / scene.speed);
      }
      onProject((current) => {
        const currentScene = current.scenes.find(
          (item) => item.id === scene.id,
        );
        if (!currentScene || currentScene.assetId !== asset.id) return current;
        if (result.boundaries) {
          const boundaries = [
            scene.start,
            ...result.boundaries,
            scene.start + scene.duration * scene.speed,
          ];
          const scenes = boundaries.slice(0, -1).map((start, index) => ({
            ...sliceScene(
              scene,
              asset.kind,
              (start - scene.start) / scene.speed,
              (boundaries[index + 1] - start) / scene.speed,
              index ? crypto.randomUUID() : scene.id,
            ),
            transition:
              index < boundaries.length - 2
                ? ("cut" as const)
                : scene.transition,
          }));
          return parseProject({
            ...current,
            scenes: current.scenes.flatMap((item) =>
              item.id === scene.id ? scenes : [item],
            ),
          });
        }
        if (!result.media) return current;
        const derived = result.media.asset;
        let next = addAsset(current, derived);
        if (operation === "proxy")
          return {
            ...next,
            assets: {
              ...next.assets,
              [asset.id]: { ...asset, proxyAssetId: derived.id },
            },
          };
        if (operation === "frame")
          return insertScenes(
            next,
            [
              {
                ...createScene(derived),
                transform: {
                  ...scene.transform,
                  ...cameraPose(scene, localTime),
                  motion: "none",
                },
                adjustments: scene.adjustments,
              },
            ],
            scene.id,
          );
        if (derived.kind === "audio") {
          const clip = audioClipSchema.parse({
            id: crypto.randomUUID(),
            assetId: derived.id,
            role: "voiceover",
            start: entry.start,
            offset: 0,
            duration: Math.min(scene.duration, derived.duration),
            volume: scene.volume,
            fadeIn: scene.audioFadeIn,
            fadeOut: scene.audioFadeOut,
            loop: false,
          });
          return parseProject({
            ...next,
            audioClips: [...next.audioClips, clip],
            scenes: next.scenes.map((item) =>
              item.id === scene.id ? { ...item, volume: 0 } : item,
            ),
          });
        }
        next = {
          ...next,
          scenes: next.scenes.map((item) =>
            item.id === scene.id
              ? { ...item, assetId: derived.id, start: 0 }
              : item,
          ),
        };
        return parseProject(next);
      });
    } catch (error) {
      if (!controller.signal.aborted)
        setOperationError(
          error instanceof Error
            ? error.message
            : "This media tool could not finish",
        );
    } finally {
      setBusy(false);
      cancel.current = null;
    }
  };
  return {
    busy,
    operationError,
    process,
    saveFrame,
    cancel: () => cancel.current?.abort(),
  };
}
