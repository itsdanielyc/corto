import { useT } from "../i18n/locale";
import { memo, useMemo, useRef, useState } from "react";
import {
  CircleHelp,
  ImagePlus,
  Images,
  LoaderCircle,
  Music2,
  Plus,
  Search,
  ShieldCheck,
  Type,
  X,
  CircleAlert,
} from "lucide-react";
import type { MediaAsset, Project, Scene } from "../../contracts/project";
import type { MediaResources } from "../hooks/use-resources";
import { formatTime } from "../domain/timeline";
import { IconButton } from "./primitives";
import { sortMedia } from "../domain/slideshow";
import { usedAssetIds } from "../domain/editing";
export type LibraryMode = "media" | "titles" | "music";
interface LibraryProperties {
  mode: LibraryMode;
  onMode: (mode: LibraryMode) => void;
  project: Project;
  resources: MediaResources;
  busy: boolean;
  backend: string;
  onImport: (music?: boolean) => void;
  onAdd: (asset: MediaAsset) => void;
  onTitle: (caption?: string, style?: Scene["captionStyle"]) => void;
  onExample: () => void;
  onHelp: () => void;
  onMusic: (clips: Project["audioClips"]) => void;
  onSound: () => void;
  onSubtitles: () => void;
  onFolder: () => void;
  onSlideshow: () => void;
  onReplace: (id: string, file: File) => void;
}
export function NavigationRail({
  mode,
  onMode,
  onHelp,
}: Pick<LibraryProperties, "mode" | "onMode" | "onHelp">) {
  const t = useT();
  return (
    <nav className="navigation-rail" aria-label={t("Creative tools")}>
      {(
        [
          { id: "media", label: "Media", icon: Images },
          { id: "titles", label: "Titles", icon: Type },
          { id: "music", label: "Music", icon: Music2 },
        ] as const
      ).map((item) => (
        <button
          key={item.id}
          aria-label={t(item.label)}
          aria-pressed={mode === item.id}
          className={mode === item.id ? "rail-item selected" : "rail-item"}
          onClick={() => onMode(item.id)}
        >
          <item.icon size={20} strokeWidth={1.7} />
          <span>{t(item.label)}</span>
        </button>
      ))}
      <div className="rail-spacer" />
      <button
        className="rail-item"
        aria-label={t("Help and shortcuts")}
        onClick={onHelp}
      >
        <CircleHelp size={20} />
        <span>{t("Help")}</span>
      </button>
    </nav>
  );
}
export const Library = memo(function Library({
  mode,
  project,
  resources,
  busy,
  backend,
  onImport,
  onAdd,
  onTitle,
  onExample,
  onMusic,
  onSound,
  onSubtitles,
  onFolder,
  onSlideshow,
  onReplace,
}: LibraryProperties) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "date" | "type" | "used">("name");
  const [context, setContext] = useState<string | null>(null);
  const replacement = useRef<HTMLInputElement>(null);
  const used = useMemo(() => usedAssetIds(project), [project]);
  const assets = useMemo(
    () =>
      sortMedia(
        Object.values(project.assets).filter(
          (asset) =>
            !asset.isOriginalOnly &&
            !asset.isProxy &&
            asset.kind !== "lut" &&
            (mode === "music"
              ? asset.kind === "audio"
              : asset.kind !== "audio") &&
            asset.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        ),
        sort === "date" ? "date" : "name",
      ).sort((a, b) =>
        sort === "used"
          ? Number(used.has(b.id)) - Number(used.has(a.id))
          : sort === "type"
            ? a.kind.localeCompare(b.kind)
            : 0,
      ),
    [project.assets, mode, query, sort, used],
  );
  const musicClip = project.audioClips.find((clip) => clip.role === "music");
  const soundtrack = musicClip ? project.assets[musicClip.assetId] : null;
  const usedAudio = useMemo(
    () => new Set(project.audioClips.map((clip) => clip.assetId)),
    [project.audioClips],
  );
  return (
    <aside
      className="media-library"
      aria-label={t("Media library")}
      data-geo="library"
    >
      <div className="library-heading">
        <h2>
          {mode === "media"
            ? t("Your media")
            : mode === "music"
              ? t("Make it feel something.")
              : t("A few words.")}
        </h2>
        {mode === "media" && (
          <span className="count-badge">
            {
              Object.values(project.assets).filter(
                (asset) => asset.kind !== "audio" && !asset.isOriginalOnly,
              ).length
            }
          </span>
        )}
      </div>
      <p className="library-description">
        {mode === "media"
          ? t("All the moments that make your film.")
          : mode === "music"
            ? t("Give your memories a soundtrack.")
            : t("A beginning, an ending, or a little context.")}
      </p>
      {mode !== "titles" && (
        <button
          className="button import-button"
          onClick={() => onImport(mode === "music")}
          disabled={busy}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Plus size={17} />
          )}
          {mode === "music" ? t("Import music") : t("Import media")}
        </button>
      )}
      {mode === "music" && (
        <button className="button secondary" onClick={onSound}>
          {t("Sound & narration")}
        </button>
      )}
      {mode === "media" && (
        <div className="library-secondary-actions">
          <button className="text-button" onClick={onFolder}>
            {t("Import folder")}
          </button>
          <button className="text-button" onClick={onSlideshow}>
            {t("Make a slideshow")}
          </button>
        </div>
      )}
      {mode === "titles" && (
        <button className="button secondary" onClick={onSubtitles}>
          {t("Timed subtitles")}
        </button>
      )}
      {mode === "titles" ? (
        <div className="title-presets">
          <button
            className="title-preset classic"
            onClick={() => onTitle("A new chapter.")}
          >
            <span>
              {t("A new")}
              <br />
              <em>{t("chapter.")}</em>
            </span>
            <small>
              {t("Classic title")}
              <Plus size={14} />
            </small>
          </button>
          <button
            className="title-preset modern"
            onClick={() => onTitle("GOOD TIMES,\nGREAT COMPANY.", "modern")}
          >
            <span>
              {t("GOOD TIMES,")}
              <br />
              {t("GREAT COMPANY.")}
            </span>
            <small>
              {t("Bold statement")}
              <Plus size={14} />
            </small>
          </button>
          <button
            className="title-preset minimal"
            onClick={() => onTitle("MADE WITH LOVE", "minimal")}
          >
            <span>{t("MADE WITH LOVE")}</span>
            <small>
              {t("A quiet note")}
              <Plus size={14} />
            </small>
          </button>
          <p className="library-tip">
            {t("Add a title card, then make it yours in the scene panel.")}
          </p>
        </div>
      ) : (
        <>
          {!!Object.keys(project.assets).length && (
            <label className="library-search">
              <Search size={15} />
              <input
                aria-label={t("Search media")}
                placeholder={t(
                  mode === "music" ? "Find your music" : "Find a moment",
                )}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          )}
          <div className={`asset-grid ${mode === "music" ? "audio-grid" : ""}`}>
            {!!assets.length && (
              <label className="library-sort">
                {t("Sort")}
                <select
                  aria-label={t("Library sort")}
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as typeof sort)
                  }
                >
                  <option value="name">{t("Filename")}</option>
                  <option value="date">{t("Date taken")}</option>
                  <option value="type">{t("Media type")}</option>
                  <option value="used">{t("Used first")}</option>
                </select>
              </label>
            )}
            {assets.map((asset) => {
              const resource = resources[asset.id];
              return (
                <button
                  className={`media-tile ${usedAudio.has(asset.id) ? "chosen" : ""}`}
                  key={asset.id}
                  draggable={!busy}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/x-corto-asset",
                      asset.id,
                    );
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContext(asset.id);
                  }}
                  disabled={busy || !!resource?.error}
                  onClick={() => onAdd(asset)}
                  aria-label={t(
                    `${asset.kind === "audio" ? "Use" : "Add"} ${asset.name}`,
                  )}
                  title={t(resource?.error ?? asset.name)}
                >
                  <div className="media-poster">
                    {asset.kind === "audio" ? (
                      <Music2 size={24} />
                    ) : resource?.poster ? (
                      <img src={resource.poster} alt="" />
                    ) : resource?.error ? (
                      <CircleAlert size={20} />
                    ) : (
                      <LoaderCircle
                        size={20}
                        className="spin"
                        data-testid="library-loading"
                      />
                    )}
                    {asset.kind === "video" && (
                      <span className="media-duration">
                        {formatTime(asset.duration)}
                      </span>
                    )}
                    <span className="add-media">
                      <Plus size={13} />
                    </span>
                  </div>
                  <span className="media-name">
                    {asset.name.replace(/\.[^.]+$/, "")}
                  </span>
                  <small>
                    {used.has(asset.id) && (
                      <span className="used-indicator">
                        {t("Used \u00B7 ")}
                      </span>
                    )}
                    {asset.kind === "audio"
                      ? formatTime(asset.duration)
                      : asset.kind === "image"
                        ? t("Photo")
                        : t("Video")}
                  </small>
                </button>
              );
            })}
          </div>
          {!assets.length && (
            <div className="library-empty">
              {mode === "music" ? (
                <Music2 size={26} />
              ) : (
                <ImagePlus size={28} />
              )}
              <p>
                {query
                  ? t("No matching media")
                  : mode === "music"
                    ? t("Your soundtrack starts here")
                    : t("A home for your moments")}
              </p>
              <span>
                {mode === "music"
                  ? t(
                      "MP3, WAV, M4A, AAC or FLAC.\nYour music stays on your device.",
                    )
                  : t(
                      "Bring in photos and video clips.\nWe’ll put them in your storyboard.",
                    )}
              </span>
              {!Object.keys(project.assets).length && mode === "media" && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={onExample}
                >
                  {t("Try an example")}
                  <span>{t("\u2197")}</span>
                </button>
              )}
            </div>
          )}
          {mode === "music" && musicClip && soundtrack && (
            <div className="music-settings">
              <div className="setting-heading">
                <h3>{t("Your soundtrack")}</h3>
                <IconButton
                  icon={X}
                  label={t("Remove soundtrack")}
                  onClick={() =>
                    onMusic(
                      project.audioClips.filter(
                        (clip) => clip.id !== musicClip.id,
                      ),
                    )
                  }
                />
              </div>
              <p className="track-name">{soundtrack.name}</p>
              <label className="range-label">
                {t("Music volume")}
                <span>
                  {Math.round(musicClip.volume * 100)}
                  {t("%")}
                </span>
                <input
                  aria-label={t("Music volume")}
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(musicClip.volume * 100)}
                  onChange={(event) =>
                    onMusic(
                      project.audioClips.map((clip) =>
                        clip.id === musicClip.id
                          ? {
                              ...clip,
                              volume: Number(event.target.value) / 100,
                            }
                          : clip,
                      ),
                    )
                  }
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={musicClip.followFilm && musicClip.loop}
                  onChange={(event) =>
                    onMusic(
                      project.audioClips.map((clip) =>
                        clip.id === musicClip.id
                          ? {
                              ...clip,
                              loop: event.target.checked,
                              followFilm: event.target.checked,
                            }
                          : clip,
                      ),
                    )
                  }
                />
                {t("Loop to the end of the film")}
              </label>
            </div>
          )}
        </>
      )}
      <div className="library-footer">
        <ShieldCheck size={16} />
        <span>
          {t("Yours to make.")}
          <br />
          <strong>{t("Yours to keep.")}</strong>
        </span>
        {backend === "mock" && <span className="mock-badge">{t("mock")}</span>}
      </div>
      <input
        hidden
        ref={replacement}
        type="file"
        aria-label={t("Replace library media")}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file && context) onReplace(context, file);
          setContext(null);
        }}
      />
      {context && (
        <div
          className="library-replace-menu"
          role="menu"
          aria-label={t("Media actions")}
        >
          <button role="menuitem" onClick={() => replacement.current?.click()}>
            {t("Replace / relink ")}
            {project.assets[context]?.name}
          </button>
          <button role="menuitem" onClick={() => setContext(null)}>
            {t("Close menu")}
          </button>
        </div>
      )}
    </aside>
  );
});
