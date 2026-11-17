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
  const [preferences, setPreferences] = useState(() =>
    preferencesSchema.parse({
      defaults: project.defaults,
      output: project.output,
    }),
  );
  const [error, setError] = useState("");
  const [update, setUpdate] = useState<UpdateInformation | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    void platform
      .loadPreferences?.()
      .then(setPreferences)
      .catch((error) => setError(String(error)));
  }, [platform]);
  const defaults = (changes: Partial<Preferences["defaults"]>) =>
    setPreferences((current) => ({
      ...current,
      defaults: { ...current.defaults, ...changes },
    }));
  const save = async () => {
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
      title="Settings & defaults"
      onClose={onClose}
      className="slideshow-dialog"
    >
      <div className="slideshow-layout">
        <ToolSection title="New scenes">
          <Numeric
            label="Default photo duration"
            value={preferences.defaults.photoSeconds}
            min={0.25}
            max={120}
            onChange={(photoSeconds) => defaults({ photoSeconds })}
          />
          <Choice
            label="Default photo framing"
            value={preferences.defaults.fit}
            options={[
              ["cover", "Fill frame"],
              ["contain", "Show whole photo"],
            ]}
            onChange={(fit) => defaults({ fit })}
          />
          <Choice
            label="Default transition"
            value={preferences.defaults.transition}
            options={TRANSITION_CHOICES}
            onChange={(transition) => defaults({ transition })}
          />
          <Numeric
            label="Default transition duration"
            value={preferences.defaults.transitionSeconds}
            min={0}
            max={5}
            onChange={(transitionSeconds) => defaults({ transitionSeconds })}
          />
          <Choice
            label="Default title style"
            value={preferences.defaults.titleStyle}
            options={[
              ["classic", "Classic"],
              ["modern", "Modern"],
              ["minimal", "Minimal"],
            ]}
            onChange={(titleStyle) => defaults({ titleStyle })}
          />
          <Colour
            label="Default background"
            value={preferences.defaults.background}
            onChange={(background) => defaults({ background })}
          />
          <Choice
            label="Default export resolution"
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
            These defaults apply to new scenes in this film and new films.
            Existing scenes keep their edits.
          </p>
        </ToolSection>
        <div>
          <ToolSection title="Editor">
            <Choice
              label="Language"
              value={preferences.locale}
              options={[
                ["en", "English"],
                ["es", "Español"],
              ]}
              onChange={(locale) => setPreferences({ ...preferences, locale })}
            />
            <Toggle
              label="Use proportional timeline"
              checked={preferences.timeline}
              onChange={(timeline) =>
                setPreferences({ ...preferences, timeline })
              }
            />
            <Numeric
              label="Timeline zoom"
              value={preferences.timelineZoom}
              min={4}
              max={200}
              step={1}
              onChange={(timelineZoom) =>
                setPreferences({ ...preferences, timelineZoom })
              }
            />
            <Toggle
              label="Prefer editing proxies when available"
              checked={preferences.proxyEditing}
              onChange={(proxyEditing) =>
                setPreferences({ ...preferences, proxyEditing })
              }
            />
          </ToolSection>
          <ToolSection title="Updates">
            <Toggle
              label="Check for new releases when Corto opens"
              checked={preferences.checkUpdates}
              onChange={(checkUpdates) =>
                setPreferences({ ...preferences, checkUpdates })
              }
            />
            <p className="dialog-note">
              Checking contacts GitHub for public release information. Your
              projects and media stay on this device.
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
              Check for updates
            </button>
            {checked &&
              (update ? (
                <>
                  <p>
                    Version {update.version} is available.
                    {!update.signed && " This is an unsigned preview."}
                  </p>
                  <a
                    className="button secondary"
                    href={update.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open release downloads
                  </a>
                </>
              ) : (
                <p>You are using the latest published version.</p>
              ))}
          </ToolSection>
        </div>
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          onClick={() => {
            void save();
          }}
        >
          Save settings
        </button>
      </div>
    </Modal>
  );
}
