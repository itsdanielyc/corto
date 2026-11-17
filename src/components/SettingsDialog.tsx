import { useT } from "../i18n/locale";
import { useEffect, useState } from "react";
import { preferencesSchema } from "../../contracts/creative";
import type { Preferences, Project } from "../../contracts/project";
import type { UpdateInformation } from "../../contracts/services";
import type { CortoPlatform } from "../platform/types";
import { Modal } from "./primitives";
import { Choice, Colour, Numeric, Toggle, ToolSection } from "./tools/Fields";
import { TRANSITION_CHOICES } from "./tools/PictureTools";
export function SettingsDialog({
  project,
  platform,
  onSave,
  onClose,
}: {
  project: Project;
  platform: CortoPlatform;
  onSave: (preferences: Preferences) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [preferences, setPreferences] = useState(() =>
    preferencesSchema.parse({
      defaults: project.defaults,
      output: project.output,
    }),
  );
  const [error, setError] = useState("");
  const [update, setUpdate] = useState<UpdateInformation | null>(null);
  const [checked, setChecked] = useState(false);
  const [ready, setReady] = useState(!platform.loadPreferences);
  useEffect(() => {
    let cancelled = false;
    void platform
      .loadPreferences?.()
      .then((saved) => {
        if (cancelled) return;
        setPreferences(saved);
        setReady(true);
      })
      .catch((error) => {
        if (!cancelled) setError(String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [platform]);
  const defaults = (changes: Partial<Preferences["defaults"]>) =>
    setPreferences((current) => ({
      ...current,
      defaults: { ...current.defaults, ...changes },
    }));
  const save = async () => {
    if (!ready) return;
    try {
      const parsed = preferencesSchema.parse(preferences);
      await platform.savePreferences?.(parsed);
      onSave(parsed);
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Settings could not be saved",
      );
    }
  };
  return (
    <Modal
      title={t("Settings & defaults")}
      onClose={onClose}
      className="slideshow-dialog"
    >
      {!ready && !error && <p role="status">{t("Loading saved settings…")}</p>}
      <fieldset className="slideshow-layout settings-fields" disabled={!ready}>
        <ToolSection title={t("New scenes")}>
          <Numeric
            label={t("Default photo duration")}
            value={preferences.defaults.photoSeconds}
            min={0.25}
            max={120}
            onChange={(photoSeconds) => defaults({ photoSeconds })}
          />
          <Choice
            label={t("Default photo framing")}
            value={preferences.defaults.fit}
            options={[
              ["cover", "Fill frame"],
              ["contain", "Show whole photo"],
            ]}
            onChange={(fit) => defaults({ fit })}
          />
          <Choice
            label={t("Default transition")}
            value={preferences.defaults.transition}
            options={TRANSITION_CHOICES}
            onChange={(transition) => defaults({ transition })}
          />
          <Numeric
            label={t("Default transition duration")}
            value={preferences.defaults.transitionSeconds}
            min={0}
            max={5}
            onChange={(transitionSeconds) => defaults({ transitionSeconds })}
          />
          <Choice
            label={t("Default title style")}
            value={preferences.defaults.titleStyle}
            options={[
              ["classic", "Classic"],
              ["modern", "Modern"],
              ["minimal", "Minimal"],
            ]}
            onChange={(titleStyle) => defaults({ titleStyle })}
          />
          <Colour
            label={t("Default background")}
            value={preferences.defaults.background}
            onChange={(background) => defaults({ background })}
          />
          <Choice
            label={t("Default export resolution")}
            value={preferences.output.resolution}
            options={[
              ["720p", "HD · 720p"],
              ["1080p", "Full HD · 1080p"],
              ["2160p", "4K · 2160p"],
            ]}
            onChange={(resolution) =>
              setPreferences({
                ...preferences,
                output: { ...preferences.output, resolution },
              })
            }
          />
          <p className="dialog-note">
            {t(
              "These defaults apply to new scenes in this film and new films. Existing scenes keep their edits.",
            )}
          </p>
        </ToolSection>
        <div>
          <ToolSection title={t("Editor")}>
            <button
              className="button secondary"
              onClick={() => {
                void import("../models/cache")
                  .then((module) => module.clearModelFiles())
                  .catch((error) => setError(String(error)));
              }}
            >
              {t("Remove downloaded local models")}
            </button>
            <Choice
              label={t("Language")}
              value={preferences.locale}
              options={[
                ["en", "English"],
                ["es", "Español"],
              ]}
              onChange={(locale) => setPreferences({ ...preferences, locale })}
            />
            <Toggle
              label={t("Use proportional timeline")}
              checked={preferences.timeline}
              onChange={(timeline) =>
                setPreferences({ ...preferences, timeline })
              }
            />
            <Numeric
              label={t("Timeline zoom")}
              value={preferences.timelineZoom}
              min={4}
              max={200}
              step={1}
              onChange={(timelineZoom) =>
                setPreferences({ ...preferences, timelineZoom })
              }
            />
            <Toggle
              label={t("Prefer editing proxies when available")}
              checked={preferences.proxyEditing}
              onChange={(proxyEditing) =>
                setPreferences({ ...preferences, proxyEditing })
              }
            />
          </ToolSection>
          <ToolSection title={t("Updates")}>
            <Toggle
              label={t("Check for new releases when Corto opens")}
              checked={preferences.checkUpdates}
              onChange={(checkUpdates) =>
                setPreferences({ ...preferences, checkUpdates })
              }
            />
            <p className="dialog-note">
              {t(
                "Checking contacts GitHub for public release information. Your projects and media stay on this device.",
              )}
            </p>
            <button
              className="button secondary"
              onClick={() => {
                void platform
                  .checkForUpdate?.()
                  .then((value) => {
                    setUpdate(value);
                    setChecked(true);
                  })
                  .catch((error) => setError(String(error)));
              }}
            >
              {t("Check for updates")}
            </button>
            {checked &&
              (update ? (
                <>
                  <p>
                    {t("Version ")}
                    {update.version}
                    {t(" is available.")}
                    {!update.signed && " This is an unsigned preview."}
                  </p>
                  <a
                    className="button secondary"
                    href={update.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Open release downloads")}
                  </a>
                </>
              ) : (
                <p>{t("You are using the latest published version.")}</p>
              ))}
          </ToolSection>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          {t("Cancel")}
        </button>
        <button
          className="button primary"
          disabled={!ready}
          onClick={() => {
            void save();
          }}
        >
          {t("Save settings")}
        </button>
      </div>
    </Modal>
  );
}
