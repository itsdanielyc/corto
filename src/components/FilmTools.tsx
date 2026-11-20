import { useT } from "../i18n/locale";
import { useState } from "react";
import type { Project, Scene } from "../../contracts/project";
import {
  changeScenes,
  removeUnusedAssets,
  sceneEffects,
} from "../domain/editing";
import { buildTimeline } from "../domain/timeline";
import { Panel } from "./primitives";
import { Choice, Numeric, Toggle, ToolSection } from "./tools/Fields";
import { MOTION_CHOICES, TRANSITION_CHOICES } from "./tools/PictureTools";
export function FilmTools({
  project,
  selectedIds,
  time,
  timelineMode,
  zoom,
  onTimeline,
  onZoom,
  onChange,
  onSeek,
  onClose,
}: {
  project: Project;
  selectedIds: ReadonlySet<string>;
  time: number;
  timelineMode: boolean;
  zoom: number;
  onTimeline: (enabled: boolean) => void;
  onZoom: (zoom: number) => void;
  onChange: (update: (project: Project) => Project) => void;
  onSeek: (time: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [all, setAll] = useState(false);
  const [seconds, setSeconds] = useState(project.defaults.photoSeconds);
  const [motion, setMotion] = useState<Scene["transform"]["motion"]>("zoom-in");
  const [transition, setTransition] = useState<Scene["transition"]>("dissolve");
  const [transitionSeconds, setTransitionSeconds] = useState(0.5);
  const [marker, setMarker] = useState("");
  const [group, setGroup] = useState("");
  const ids = all
    ? new Set(project.scenes.map((scene) => scene.id))
    : selectedIds;
  const apply = (update: (scene: Scene, index: number) => Scene) =>
    onChange((current) => {
      let index = 0;
      return changeScenes(current, ids, (scene) => update(scene, index++));
    });
  return (
    <Panel
      title={t("Film tools & bulk edits")}
      onClose={onClose}
      className="film-tools"
    >
      <p className="modal-introduction">
        {selectedIds.size}
        {t(" scene")}
        {selectedIds.size === 1 ? "" : t("s")}
        {t(
          " selected. Ctrl/\u2318 click or Shift click in the storyboard to select more.",
        )}
      </p>
      <div className="slideshow-layout">
        <div>
          <ToolSection title={t("Apply together")}>
            <Toggle
              label={t("Apply to every scene")}
              checked={all}
              onChange={setAll}
            />
            <Numeric
              label={t("Bulk photo duration")}
              value={seconds}
              min={0.25}
              max={120}
              onChange={setSeconds}
            />
            <button
              className="button secondary"
              onClick={() =>
                apply((scene) =>
                  scene.assetId &&
                  project.assets[scene.assetId].kind === "image"
                    ? { ...scene, duration: seconds }
                    : scene,
                )
              }
            >
              {t("Set photo durations")}
            </button>
            <Choice
              label={t("Bulk photo motion")}
              value={motion}
              options={MOTION_CHOICES}
              onChange={setMotion}
            />
            <button
              className="button secondary"
              onClick={() =>
                apply((scene) => ({
                  ...scene,
                  transform: { ...scene.transform, motion },
                }))
              }
            >
              {t("Apply motion")}
            </button>
            <button
              className="button secondary"
              onClick={() =>
                apply((scene, index) => ({
                  ...scene,
                  transform: {
                    ...scene.transform,
                    motion: (
                      [
                        "zoom-in",
                        "pan-right",
                        "zoom-out",
                        "pan-left",
                        "pan-up",
                        "pan-down",
                      ] as const
                    )[index % 6],
                  },
                }))
              }
            >
              {t("Vary photo motion")}
            </button>
            <Choice
              label={t("Bulk transition")}
              value={transition}
              options={TRANSITION_CHOICES}
              onChange={setTransition}
            />
            <Numeric
              label={t("Bulk transition duration")}
              value={transitionSeconds}
              min={0}
              max={5}
              onChange={setTransitionSeconds}
            />
            <button
              className="button secondary"
              onClick={() =>
                apply((scene) => ({ ...scene, transition, transitionSeconds }))
              }
            >
              {t("Apply transitions")}
            </button>
            <button
              className="button secondary"
              onClick={() => {
                const first = project.scenes.find((scene) =>
                  selectedIds.has(scene.id),
                );
                if (first)
                  apply((scene) => ({ ...scene, ...sceneEffects(first) }));
              }}
            >
              {t("Apply first selected scene's effects")}
            </button>
            <button
              className="button secondary"
              onClick={() =>
                apply((scene) => {
                  const asset = scene.assetId
                    ? project.assets[scene.assetId]
                    : null;
                  return asset
                    ? {
                        ...scene,
                        caption: [
                          asset.capturedAt
                            ? new Date(asset.capturedAt).toLocaleDateString()
                            : "",
                          asset.camera ?? "",
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      }
                    : scene;
                })
              }
            >
              {t("Caption from capture date / camera")}
            </button>
          </ToolSection>
        </div>
        <div>
          <ToolSection title={t("Timeline & library")}>
            <Toggle
              label={t("Proportional timeline")}
              checked={timelineMode}
              onChange={onTimeline}
            />
            <Numeric
              label={t("Timeline pixels per second")}
              value={zoom}
              min={4}
              max={200}
              step={1}
              onChange={onZoom}
            />
            <button
              className="button secondary"
              onClick={() => onChange(removeUnusedAssets)}
            >
              {t("Remove unused library items")}
            </button>
            <p className="dialog-note">
              {t(
                "Library cleanup removes references in this film. It keeps source files and other films' history.",
              )}
            </p>
          </ToolSection>
          <ToolSection title={t("Markers & chapters")}>
            <label className="field-label">
              {t("Marker name")}
              <input
                aria-label={t("Marker name")}
                maxLength={80}
                value={marker}
                onChange={(event) => setMarker(event.target.value)}
              />
            </label>
            <button
              className="button secondary"
              disabled={!marker.trim()}
              onClick={() => {
                onChange((current) => ({
                  ...current,
                  markers: [
                    ...current.markers,
                    {
                      id: crypto.randomUUID(),
                      time,
                      name: marker.trim(),
                      chapter: true,
                    },
                  ],
                }));
                setMarker("");
              }}
            >
              {t("Add marker at playhead")}
            </button>
            {project.markers.map((item) => (
              <div className="tool-button-row" key={item.id}>
                <button
                  className="text-button"
                  onClick={() => onSeek(item.time)}
                >
                  {item.name}
                  {t(" \u00B7 ")}
                  {item.time.toFixed(1)}
                  {t("s")}
                </button>
                <button
                  className="text-button"
                  aria-label={t(`Delete marker ${item.name}`)}
                  onClick={() =>
                    onChange((current) => ({
                      ...current,
                      markers: current.markers.filter(
                        (candidate) => candidate.id !== item.id,
                      ),
                    }))
                  }
                >
                  {t("Remove")}
                </button>
              </div>
            ))}
            <button
              className="button secondary"
              disabled={!project.markers.length}
              onClick={() => {
                const text = project.markers
                  .map(
                    (marker) =>
                      `${Math.floor(marker.time / 60)}:${String(Math.floor(marker.time % 60)).padStart(2, "0")} ${marker.name}`,
                  )
                  .join("\n");
                void import("../platform/browser-repository").then(
                  ({ downloadBlob }) =>
                    downloadBlob(
                      new Blob([text], { type: "text/plain" }),
                      "chapters.txt",
                    ),
                );
              }}
            >
              {t("Save chapters text")}
            </button>
            <label className="field-label">
              {t("Scene group")}
              <input
                aria-label={t("Scene group")}
                maxLength={80}
                value={group}
                onChange={(event) => setGroup(event.target.value)}
              />
            </label>
            <button
              className="button secondary"
              onClick={() => apply((scene) => ({ ...scene, group }))}
            >
              {t("Group selected scenes")}
            </button>
            <p className="dialog-note">
              {t(
                "Groups label related scenes; each scene remains independently editable.",
              )}
            </p>
          </ToolSection>
          <p className="dialog-note">
            {t("Film length:")}{" "}
            {buildTimeline(project.scenes).at(-1)?.end.toFixed(1) ?? 0}
            {t(" seconds.")}
          </p>
        </div>
      </div>
      <div className="modal-actions">
        <button className="button primary" onClick={onClose}>
          {t("Done")}
        </button>
      </div>
    </Panel>
  );
}
