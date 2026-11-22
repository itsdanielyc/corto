import { useT } from "../i18n/locale";
import { useEffect, useRef, useState } from "react";
import { bundledSoundFile } from "../media/bundled-sounds";
interface PackEntry {
  id: string;
  title: string;
  category: "music" | "effect";
  description: string;
  file: string;
  licence: string;
}
/** The small original CC0 library is bundled and works without an account or network connection. */
export function SoundPack({
  onAdd,
  disabled,
}: {
  onAdd: (file: File, effect: boolean) => Promise<void>;
  disabled: boolean;
}) {
  const t = useT();
  const [entries, setEntries] = useState<PackEntry[]>([]);
  const [preview, setPreview] = useState<PackEntry | null>(null);
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const base = `${import.meta.env.BASE_URL}sounds/`;
  useEffect(() => {
    let cancelled = false;
    void fetch(`${base}index.json`)
      .then((response) => {
        if (!response.ok)
          throw new Error("The bundled sound library is missing");
        return response.json();
      })
      .then((value) => {
        if (!cancelled) setEntries(value);
      })
      .catch((error) => {
        if (!cancelled) setError(String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [base]);
  const add = async (entry: PackEntry) => {
    try {
      audio.current?.pause();
      await onAdd(
        await bundledSoundFile(entry.id),
        entry.category === "effect",
      );
    } catch (error) {
      setError(String(error));
    }
  };
  return (
    <details className="sound-pack">
      <summary>
        {t("Corto's music and sounds \u00B7 28")}
      </summary>
      <p className="dialog-note">
        {t(
          "Yours to use in any film, including ones you share or sell.",
        )}
      </p>
      {preview && (
        <audio
          ref={audio}
          controls
          autoPlay
          src={`${base}${preview.file}`}
          aria-label={t(`Preview ${preview.title}`)}
        />
      )}
      <div className="sound-pack-list">
        {entries.map((entry) => (
          <div key={entry.id}>
            <div>
              <strong>{entry.title}</strong>
              <small>{entry.description}</small>
            </div>
            <button
              className="text-button"
              aria-label={t(`Preview ${entry.title}`)}
              onClick={() => setPreview(entry)}
            >
              {t("Listen")}
            </button>
            <button
              className="button secondary"
              disabled={disabled}
              aria-label={t(`Add ${entry.title}`)}
              onClick={() => {
                void add(entry);
              }}
            >
              {t("Add")}
            </button>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
    </details>
  );
}
