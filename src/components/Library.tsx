import { useT } from "../i18n/locale";
import { memo, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Check,
  CircleAlert,
  FolderInput,
  Images,
  LoaderCircle,
  Music2,
  Plus,
  Search,
  Sparkles,
  Type,
  X,
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
  onMusic: (clips: Project["audioClips"]) => void;
  onSound: () => void;
  onSubtitles: () => void;
  onFolder: () => void;
  onSlideshow: () => void;
  onReplace: (id: string, file: File) => void;
}
const TABS = [
  { id: "media", label: "Media", icon: Images },
  { id: "music", label: "Music", icon: Music2 },
  { id: "titles", label: "Titles", icon: Type },
] as const;
/** Title presets mirror the three caption styles the renderer draws. */
const TITLE_PRESETS = [
  {
    style: "classic",
    caption: "A new chapter.",
    label: "Classic title",
    preview: "A new chapter.",
  },
  {
    style: "modern",
    caption: "GOOD TIMES,\nGREAT COMPANY.",
    label: "Bold statement",
    preview: "GOOD TIMES, GREAT COMPANY.",
  },
  {
    style: "minimal",
    caption: "MADE WITH LOVE",
    label: "A quiet note",
    preview: "MADE WITH LOVE",
  },
] as const;

function LibraryTabs({
  mode,
  onMode,
}: Pick<LibraryProperties, "mode" | "onMode">) {
  const t = useT();
  return (
    <div
      className="library-tabs"
      role="tablist"
      aria-label={t("Library")}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const index = TABS.findIndex((tab) => tab.id === mode);
        const next =
          TABS[
            (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) %
              TABS.length
          ];
        onMode(next.id);
        event.currentTarget
          .querySelector<HTMLElement>(`[data-tab="${next.id}"]`)
          ?.focus();
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          data-tab={tab.id}
          aria-selected={mode === tab.id}
          tabIndex={mode === tab.id ? 0 : -1}
          onClick={() => onMode(tab.id)}
        >
          <tab.icon size={17} strokeWidth={1.75} aria-hidden="true" />
          {t(tab.label)}
        </button>
      ))}
    </div>
  );
}

function MediaTile({
  asset,
  poster,
  error,
  used,
  chosen,
  busy,
  onAdd,
  onContext,
}: {
  asset: MediaAsset;
  poster?: string;
  error?: string;
  used: boolean;
  chosen: boolean;
  busy: boolean;
  onAdd: () => void;
  onContext: () => void;
}) {
  const t = useT();
  const audio = asset.kind === "audio";
  return (
    <button
      className={`media-tile ${audio ? "audio-tile" : ""} ${chosen ? "chosen" : ""}`}
      draggable={!busy}
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-corto-asset", asset.id);
        event.dataTransfer.effectAllowed = "copy";
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onContext();
      }}
      disabled={busy || !!error}
      onClick={onAdd}
      aria-label={t(`${audio ? "Use" : "Add"} ${asset.name}`)}
      title={t(error ?? asset.name)}
    >
      <span className="media-poster">
        {audio ? (
          <Music2 size={18} aria-hidden="true" />
        ) : poster ? (
          <img src={poster} alt="" draggable={false} />
        ) : error ? (
          <CircleAlert size={18} aria-hidden="true" />
        ) : (
          <LoaderCircle
            size={18}
            className="spin"
            data-testid="library-loading"
            aria-hidden="true"
          />
        )}
        {asset.kind === "video" && (
          <span className="media-duration">{formatTime(asset.duration)}</span>
        )}
        {used && !audio && (
          <span className="used-indicator" title={t("In the film")}>
            <Check size={11} strokeWidth={2.5} aria-hidden="true" />
          </span>
        )}
        {!audio && (
          <span className="add-media" aria-hidden="true">
            <Plus size={14} />
          </span>
        )}
      </span>
      <span className="media-text">
        <span className="media-name">{asset.name.replace(/\.[^.]+$/, "")}</span>
        <small>
          {used && t("Used · ")}
          {audio
            ? formatTime(asset.duration)
            : asset.kind === "image"
              ? t("Photo")
              : t("Video")}
        </small>
      </span>
    </button>
  );
}

/** Left panel: the material a film is made from, grouped by what it becomes. */
export const Library = memo(function Library({
  mode,
  onMode,
  project,
  resources,
  busy,
  backend,
  onImport,
  onAdd,
  onTitle,
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
  const hasAnyAssets = Object.keys(project.assets).length > 0;
  const updateMusic = (changes: Partial<Project["audioClips"][number]>) =>
    musicClip &&
    onMusic(
      project.audioClips.map((clip) =>
        clip.id === musicClip.id ? { ...clip, ...changes } : clip,
      ),
    );
  return (
    <aside
      className="media-library"
      aria-label={t("Media library")}
      data-geo="library"
    >
      <LibraryTabs mode={mode} onMode={onMode} />
      <div className="library-body" role="tabpanel" key={mode}>
        {mode === "titles" ? (
          <>
            <div className="library-actions">
              <button className="button secondary wide" onClick={onSubtitles}>
                {t("Timed subtitles")}
              </button>
            </div>
            <h2 className="library-heading">{t("Title cards")}</h2>
            <div className="title-presets">
              {TITLE_PRESETS.map((preset) => (
                <button
                  key={preset.style}
                  className={`title-preset ${preset.style}`}
                  disabled={busy}
                  onClick={() =>
                    onTitle(
                      preset.caption,
                      preset.style === "classic" ? undefined : preset.style,
                    )
                  }
                >
                  <span className={`title-preset-art caption-${preset.style}`}>
                    {t(preset.preview)}
                  </span>
                  <span className="title-preset-label">
                    {t(preset.label)}
                    <Plus size={14} aria-hidden="true" />
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="library-actions">
              <button
                className="button secondary wide import-button"
                onClick={() => onImport(mode === "music")}
                disabled={busy}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={16} aria-hidden="true" />
                ) : (
                  <Plus size={16} aria-hidden="true" />
                )}
                {mode === "music" ? t("Import music") : t("Import media")}
              </button>
              {mode === "media" && (
                <div className="library-secondary-actions">
                  <button className="library-row" onClick={onFolder}>
                    <FolderInput size={16} aria-hidden="true" />
                    {t("Import folder")}
                  </button>
                  <button className="library-row" onClick={onSlideshow}>
                    <Sparkles size={16} aria-hidden="true" />
                    {t("Make a slideshow")}
                  </button>
                </div>
              )}
              {mode === "music" && (
                <button className="button quiet wide" onClick={onSound}>
                  {t("Sound & narration")}
                </button>
              )}
            </div>
            {mode === "music" && musicClip && soundtrack && (
              <section
                className="music-settings"
                aria-label={t("Your soundtrack")}
              >
                <div className="setting-heading">
                  <Music2 size={16} aria-hidden="true" />
                  <div>
                    <h3>{t("Your soundtrack")}</h3>
                    <p className="track-name">{soundtrack.name}</p>
                  </div>
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
                    style={
                      {
                        "--progress": `${Math.min(100, musicClip.volume * 100)}%`,
                      } as CSSProperties
                    }
                    onChange={(event) =>
                      updateMusic({ volume: Number(event.target.value) / 100 })
                    }
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={musicClip.followFilm && musicClip.loop}
                    onChange={(event) =>
                      updateMusic({
                        loop: event.target.checked,
                        followFilm: event.target.checked,
                      })
                    }
                  />
                  {t("Loop to the end of the film")}
                </label>
              </section>
            )}
            {hasAnyAssets && (
              <div className="library-filter">
                <label className="library-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="search"
                    aria-label={t("Search media")}
                    placeholder={t(
                      mode === "music" ? "Search music" : "Search",
                    )}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                {!!assets.length && (
                  <label className="library-sort">
                    <span className="sr-only">{t("Sort")}</span>
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
              </div>
            )}
            {!!assets.length && (
              <div
                className={`asset-grid ${mode === "music" ? "audio-grid" : ""}`}
              >
                {assets.map((asset) => (
                  <MediaTile
                    key={asset.id}
                    asset={asset}
                    poster={resources[asset.id]?.poster ?? undefined}
                    error={resources[asset.id]?.error}
                    used={used.has(asset.id)}
                    chosen={usedAudio.has(asset.id)}
                    busy={busy}
                    onAdd={() => onAdd(asset)}
                    onContext={() => setContext(asset.id)}
                  />
                ))}
              </div>
            )}
            {!assets.length && (
              <div className="library-empty">
                <p>
                  {query
                    ? t("No matching media")
                    : mode === "music"
                      ? t("Songs you import appear here.")
                      : t("Photos and clips you import appear here.")}
                </p>
              </div>
            )}
          </>
        )}
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
        // Menus close on Escape and when focus leaves them; no "Close menu" item.
        <div
          className="library-replace-menu"
          role="menu"
          aria-label={t("Media actions")}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setContext(null);
            }
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              setContext(null);
          }}
        >
          <button
            role="menuitem"
            autoFocus
            onClick={() => replacement.current?.click()}
          >
            {t("Replace / relink ")}
            {project.assets[context]?.name}
          </button>
        </div>
      )}
    </aside>
  );
});
