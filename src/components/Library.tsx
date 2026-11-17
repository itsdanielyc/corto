import { memo, useMemo, useState } from "react";
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
}

export function NavigationRail({
  mode,
  onMode,
  onHelp,
}: Pick<LibraryProperties, "mode" | "onMode" | "onHelp">) {
  return (
    <nav className="navigation-rail" aria-label="Creative tools">
      {(
        [
          { id: "media", label: "Media", icon: Images },
          { id: "titles", label: "Titles", icon: Type },
          { id: "music", label: "Music", icon: Music2 },
        ] as const
      ).map((item) => (
        <button
          key={item.id}
          aria-label={item.label}
          aria-pressed={mode === item.id}
          className={mode === item.id ? "rail-item selected" : "rail-item"}
          onClick={() => onMode(item.id)}
        >
          <item.icon size={20} strokeWidth={1.7} />
          <span>{item.label}</span>
        </button>
      ))}
      <div className="rail-spacer" />
      <button
        className="rail-item"
        aria-label="Help and shortcuts"
        onClick={onHelp}
      >
        <CircleHelp size={20} />
        <span>Help</span>
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
}: LibraryProperties) {
  const [query, setQuery] = useState("");
  const assets = useMemo(
    () =>
      Object.values(project.assets).filter(
        (asset) =>
          !asset.isOriginalOnly &&
          (mode === "music"
            ? asset.kind === "audio"
            : asset.kind !== "audio") &&
          asset.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      ),
    [project.assets, mode, query],
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
      aria-label="Media library"
      data-geo="library"
    >
      <div className="library-heading">
        <h2>
          {mode === "media"
            ? "Your media"
            : mode === "music"
              ? "Make it feel something."
              : "A few words."}
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
          ? "All the moments that make your film."
          : mode === "music"
            ? "Give your memories a soundtrack."
            : "A beginning, an ending, or a little context."}
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
          {mode === "music" ? "Import music" : "Import media"}
        </button>
      )}
      {mode === "music" && (
        <button className="button secondary" onClick={onSound}>
          Sound &amp; narration
        </button>
      )}
      {mode === "titles" && (
        <button className="button secondary" onClick={onSubtitles}>
          Timed subtitles
        </button>
      )}
      {mode === "titles" ? (
        <div className="title-presets">
          <button
            className="title-preset classic"
            onClick={() => onTitle("A new chapter.")}
          >
            <span>
              A new
              <br />
              <em>chapter.</em>
            </span>
            <small>
              Classic title
              <Plus size={14} />
            </small>
          </button>
          <button
            className="title-preset modern"
            onClick={() => onTitle("GOOD TIMES,\nGREAT COMPANY.", "modern")}
          >
            <span>
              GOOD TIMES,
              <br />
              GREAT COMPANY.
            </span>
            <small>
              Bold statement
              <Plus size={14} />
            </small>
          </button>
          <button
            className="title-preset minimal"
            onClick={() => onTitle("MADE WITH LOVE", "minimal")}
          >
            <span>MADE WITH LOVE</span>
            <small>
              A quiet note
              <Plus size={14} />
            </small>
          </button>
          <p className="library-tip">
            Add a title card, then make it yours in the scene panel.
          </p>
        </div>
      ) : (
        <>
          {!!Object.keys(project.assets).length && (
            <label className="library-search">
              <Search size={15} />
              <input
                aria-label="Search media"
                placeholder={
                  mode === "music" ? "Find your music" : "Find a moment"
                }
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          )}
          <div className={`asset-grid ${mode === "music" ? "audio-grid" : ""}`}>
            {assets.map((asset) => {
              const resource = resources[asset.id];
              return (
                <button
                  className={`media-tile ${usedAudio.has(asset.id) ? "chosen" : ""}`}
                  key={asset.id}
                  disabled={busy || !!resource?.error}
                  onClick={() => onAdd(asset)}
                  aria-label={`${asset.kind === "audio" ? "Use" : "Add"} ${asset.name}`}
                  title={resource?.error ?? asset.name}
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
                    {asset.kind === "audio"
                      ? formatTime(asset.duration)
                      : asset.kind === "image"
                        ? "Photo"
                        : "Video"}
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
                  ? "No matching media"
                  : mode === "music"
                    ? "Your soundtrack starts here"
                    : "A home for your moments"}
              </p>
              <span>
                {mode === "music"
                  ? "MP3, WAV, M4A, AAC or FLAC.\nYour music stays on your device."
                  : "Bring in photos and video clips.\nWe’ll put them in your storyboard."}
              </span>
              {!Object.keys(project.assets).length && mode === "media" && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={onExample}
                >
                  Try an example<span>↗</span>
                </button>
              )}
            </div>
          )}
          {mode === "music" && musicClip && soundtrack && (
            <div className="music-settings">
              <div className="setting-heading">
                <h3>Your soundtrack</h3>
                <IconButton
                  icon={X}
                  label="Remove soundtrack"
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
                Music volume
                <span>{Math.round(musicClip.volume * 100)}%</span>
                <input
                  aria-label="Music volume"
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
                Loop to the end of the film
              </label>
            </div>
          )}
        </>
      )}
      <div className="library-footer">
        <ShieldCheck size={16} />
        <span>
          Yours to make.
          <br />
          <strong>Yours to keep.</strong>
        </span>
        {backend === "mock" && <span className="mock-badge">mock</span>}
      </div>
    </aside>
  );
});
