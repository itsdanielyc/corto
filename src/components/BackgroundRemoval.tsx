import { useT } from "../i18n/locale";
import { useEffect, useRef, useState } from "react";
import type { MediaAsset, Project, Scene } from "../../contracts/project";
import type { CortoPlatform } from "../platform/types";
import { LOCAL_MODELS, type ModelProgress } from "../models/catalogue";
import { addAsset } from "../domain/project";
import { inspectFile } from "../media/import";
/** Optional local matting creates a transparent copy and leaves the source in the film's library. */
export function BackgroundRemoval({
  scene,
  asset,
  platform,
  onChange,
}: {
  scene: Scene;
  asset: MediaAsset;
  platform: CortoPlatform;
  onChange: (update: (project: Project) => Project) => void;
}) {
  const t = useT();
  const abort = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<ModelProgress | null>(null);
  const [error, setError] = useState("");
  useEffect(() => () => abort.current?.abort(), []);
  const start = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setError("");
    setProgress({ message: "Preparing your photo", fraction: null });
    try {
      const response = await fetch(await platform.assetUrl(asset.id));
      if (!response.ok) throw new Error("This photo is missing");
      const image = await createImageBitmap(await response.blob());
      let blob: Blob;
      try {
        const scale = Math.min(1, 4096 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas
          .getContext("2d")!
          .drawImage(image, 0, 0, canvas.width, canvas.height);
        blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value
                ? resolve(value)
                : reject(new Error("The photo could not be prepared")),
            "image/png",
          ),
        );
      } finally {
        image.close();
      }
      const { runLocalModel } = await import("../models/client");
      const result = await runLocalModel(
        { kind: "background", image: blob },
        controller.signal,
        setProgress,
      );
      controller.signal.throwIfAborted();
      if (!("image" in result))
        throw new Error("The background model returned no picture");
      const file = new File(
        [result.image],
        `${asset.name.replace(/\.[^.]+$/, "")} — cutout.png`,
        { type: "image/png" },
      );
      const { asset: cutout } = await inspectFile(file);
      await platform.putAsset(cutout, file);
      controller.signal.throwIfAborted();
      onChange((current) => ({
        ...addAsset(current, cutout),
        scenes: current.scenes.map((item) =>
          item.id === scene.id && item.assetId === asset.id
            ? { ...item, assetId: cutout.id }
            : item,
        ),
      }));
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Local background removal failed",
        );
    } finally {
      if (!controller.signal.aborted) setProgress(null);
      abort.current = null;
    }
  };
  return (
    <details className="local-model-tool">
      <summary>{t("Remove photo background locally")}</summary>
      <p className="dialog-note">
        {t("First use downloads ")}
        {t(LOCAL_MODELS.background.download)}
        {t(" of")} {LOCAL_MODELS.background.name}
        {t(" data (")}
        {LOCAL_MODELS.background.licence}
        {t(
          "). Your photo stays on this device. The editable transparent copy is up to 4K; the original stays in the library.",
        )}
      </p>
      {progress ? (
        <>
          <p role="status">
            {progress.message}
            {progress.fraction !== null
              ? ` · ${Math.round(progress.fraction * 100)}%`
              : ""}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              abort.current?.abort();
              setProgress(null);
            }}
          >
            {t("Cancel background removal")}
          </button>
        </>
      ) : (
        <button
          className="button secondary"
          onClick={() => {
            void start();
          }}
        >
          {t("Download model / remove background")}
        </button>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {t(error)}
        </p>
      )}
    </details>
  );
}
