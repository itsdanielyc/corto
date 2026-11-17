import { useT } from "../i18n/locale";
import { useEffect, useRef, useState } from "react";
import type { Project, Subtitle } from "../../contracts/project";
import type { CortoPlatform } from "../platform/types";
import { LOCAL_MODELS, type ModelProgress } from "../models/catalogue";
import { Choice } from "./tools/Fields";
/** Draft captions stay plain and editable; only model data is downloaded, never source audio uploaded. */
export function AutomaticCaptions({
  project,
  platform,
  onCues,
  onBusy,
}: {
  project: Project;
  platform: CortoPlatform;
  onCues: (cues: Subtitle[]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const t = useT();
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [progress, setProgress] = useState<ModelProgress | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const currentReady = useRef(onCues);
  currentReady.current = onCues;
  useEffect(() => () => abort.current?.abort(), []);
  const start = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setError("");
    onBusy(true);
    setProgress({ message: "Preparing local speech", fraction: null });
    try {
      const { transcribeFilm } = await import("../models/transcribe");
      const subtitles = await transcribeFilm(
        project,
        platform,
        language,
        controller.signal,
        setProgress,
      );
      controller.signal.throwIfAborted();
      if (!subtitles.length)
        throw new Error(
          "No speech was recognised. Add captions manually or choose a clip with clearer speech.",
        );
      currentReady.current(subtitles);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Local captions could not be generated",
        );
    } finally {
      if (!controller.signal.aborted) {
        setProgress(null);
        onBusy(false);
      }
      abort.current = null;
    }
  };
  return (
    <details className="local-model-tool">
      <summary>{t("Automatic captions \u00B7 works locally")}</summary>
      <p className="dialog-note">
        {t("First use downloads ")}
        {t(LOCAL_MODELS.speech.download)}
        {t(" of")} {LOCAL_MODELS.speech.name}
        {t(" data (")}
        {LOCAL_MODELS.speech.licence}
        {t(
          "). Clip sound and narration are processed here in small sections. Review names and wording before sharing. A new draft replaces the subtitle list; Undo restores the previous edit.",
        )}
      </p>
      <Choice
        label={t("Speech language")}
        value={language}
        options={[
          ["en", "English"],
          ["es", "Español"],
        ]}
        onChange={setLanguage}
      />
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
              onBusy(false);
            }}
          >
            {t("Cancel automatic captions")}
          </button>
        </>
      ) : (
        <button
          className="button secondary"
          onClick={() => {
            void start();
          }}
        >
          {t("Download model / create caption draft")}
        </button>
      )}
      {error && (
        <p role="alert" className="inline-error">
          {t(error)}
        </p>
      )}
    </details>
  );
}
