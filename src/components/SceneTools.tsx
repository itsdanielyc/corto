import { useEffect, useRef, useState } from "react";
import type { MediaOperation } from "../../contracts/services";
import {
  audioClipSchema,
  parseProject,
  type Project,
  type Scene,
} from "../../contracts/project";
import { addAsset, createScene } from "../domain/project";
import { insertScenes } from "../domain/editing";
import { buildTimeline, frameDimensions } from "../domain/timeline";
import type { CortoPlatform } from "../platform/types";
import { CompositionPlayer } from "../preview/composition-player";
import { renderProjectFrame } from "../preview/composite";
import { loadCaptionFonts } from "../preview/captions";
import { downloadBlob, projectFileName } from "../platform/browser-repository";
import { PictureTools } from "./tools/PictureTools";
import { TextTools } from "./tools/TextTools";
import { OverlayTools } from "./tools/OverlayTools";
import { VideoTools } from "./tools/VideoTools";
import { Modal } from "./primitives";

export function SceneTools({
  project,
  scene,
  platform,
  onChange,
  onProject,
  onClose,
  report,
}: {
  project: Project;
  scene: Scene;
  platform: CortoPlatform;
  onChange: (changes: Partial<Scene>) => void;
  onProject: (update: (project: Project) => Project) => void;
  onClose: () => void;
  report: (error: unknown) => void;
}) {
  const [tab, setTab] = useState("picture");
  const [localTime, setLocalTime] = useState(Math.min(0.6, scene.duration / 2));
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cancel = useRef<AbortController | null>(null);
  const asset = scene.assetId ? project.assets[scene.assetId] : null;
  const entry = buildTimeline(project.scenes).find(
    (candidate) => candidate.scene.id === scene.id,
  )!;
  const time = entry.start + Math.min(scene.duration - 0.001, localTime);
  const dimensions = frameDimensions(project.ratio, "720p");
  useEffect(() => {
    const controller = new AbortController();
    const player = new CompositionPlayer(project, (id) =>
      platform.assetUrl(id),
    );
    void loadCaptionFonts()
      .then(() => player.prepare(time, controller.signal))
      .then((media) => {
        if (!controller.signal.aborted && canvas.current)
          renderProjectFrame(
            canvas.current.getContext("2d")!,
            project,
            time,
            media,
          );
      })
      .catch((error) => {
        if (!controller.signal.aborted) report(error);
      });
    return () => {
      controller.abort();
      player.dispose();
    };
  }, [project, platform, time, report]);
  useEffect(() => () => cancel.current?.abort(), []);
  const saveFrame = async () => {
    const player = new CompositionPlayer(project, (id) =>
      platform.assetUrl(id),
    );
    const controller = new AbortController();
    try {
      const media = await player.prepare(time, controller.signal);
      const output = document.createElement("canvas");
      Object.assign(
        output,
        frameDimensions(project.ratio, project.output.resolution),
      );
      renderProjectFrame(output.getContext("2d")!, project, time, media);
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
      onProject((current) => {
        if (result.boundaries) {
          const boundaries = [
            scene.start,
            ...result.boundaries,
            scene.start + scene.duration * scene.speed,
          ];
          const scenes = boundaries
            .slice(0, -1)
            .map((start, index) => ({
              ...scene,
              id: index ? crypto.randomUUID() : scene.id,
              start,
              duration: (boundaries[index + 1] - start) / scene.speed,
              textItems: [],
              layers: [],
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
                transform: scene.transform,
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
    } finally {
      setBusy(false);
      cancel.current = null;
    }
  };
  return (
    <Modal
      title="Scene tools"
      onClose={busy ? () => cancel.current?.abort() : onClose}
      className="creator-dialog"
    >
      <div className="creator-layout">
        <div className="creator-preview">
          <canvas
            ref={canvas}
            {...dimensions}
            aria-label="Scene tools preview"
            onPointerDown={(event) => {
              if (tab !== "picture" || !asset) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              onChange({
                transform: {
                  ...scene.transform,
                  focusX: Math.max(
                    0,
                    Math.min(1, (event.clientX - bounds.left) / bounds.width),
                  ),
                  focusY: Math.max(
                    0,
                    Math.min(1, (event.clientY - bounds.top) / bounds.height),
                  ),
                },
              });
            }}
          />
          <label className="range-label">
            Preview scene time
            <input
              aria-label="Preview scene time"
              type="range"
              min={0}
              max={scene.duration}
              step={0.01}
              value={Math.min(localTime, scene.duration)}
              onChange={(event) => setLocalTime(Number(event.target.value))}
            />
          </label>
          <p className="dialog-note">
            Click the picture to position the crop focus. Scrub to check
            movement and timed items.
          </p>
          <button
            className="button secondary"
            onClick={() => {
              void saveFrame().catch(report);
            }}
          >
            Save composed frame as PNG
          </button>
        </div>
        <div className="creator-controls">
          <div
            className="tool-tabs"
            role="tablist"
            aria-label="Scene tool categories"
          >
            {[
              ["picture", "Picture"],
              ...(asset?.kind === "video" ? [["video", "Clip"]] : []),
              ["text", "Text"],
              ["overlays", "Overlays"],
            ].map(([id, name]) => (
              <button
                role="tab"
                aria-selected={tab === id}
                key={id}
                onClick={() => setTab(id)}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="tool-content" role="tabpanel">
            {tab === "picture" && (
              <PictureTools
                project={project}
                scene={scene}
                asset={asset}
                platform={platform}
                onChange={onChange}
                report={report}
              />
            )}
            {tab === "video" && asset?.kind === "video" && (
              <VideoTools
                scene={scene}
                asset={asset}
                busy={busy}
                onChange={onChange}
                onOperation={(operation) => {
                  void process(operation).catch(report);
                }}
              />
            )}
            {tab === "text" && <TextTools scene={scene} onChange={onChange} />}
            {tab === "overlays" && (
              <OverlayTools
                project={project}
                scene={scene}
                onChange={onChange}
              />
            )}
          </div>
        </div>
      </div>
      <div className="modal-actions">
        {busy && (
          <button
            className="button secondary"
            onClick={() => cancel.current?.abort()}
          >
            Cancel media operation
          </button>
        )}
        <button className="button primary" disabled={busy} onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
