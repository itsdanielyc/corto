import { useT } from "./i18n/locale";
import { setApplicationLocale } from "./i18n/locale";
import { useEffect, useState, type CSSProperties } from "react";
import {
  Check,
  CircleAlert,
  ImagePlus,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { type Project } from "../contracts/project";
import { formatTime } from "./domain/timeline";
import { Header } from "./components/Header";
import { Library, NavigationRail } from "./components/Library";
import { Inspector } from "./components/Inspector";
import { Preview } from "./components/Preview";
import { Storyboard } from "./components/Storyboard";
import { IconButton } from "./components/primitives";
import { useEditorController } from "./hooks/use-editor-controller";
import { EditorDialogs } from "./components/EditorDialogs";
import { ProjectHome } from "./components/ProjectHome";
import { SoundDialog } from "./components/SoundDialog";
import { SubtitlesDialog } from "./components/SubtitlesDialog";
import { SceneTools } from "./components/SceneTools";
import { SlideshowDialog } from "./components/SlideshowDialog";
import { FilmTools } from "./components/FilmTools";
import { SettingsDialog } from "./components/SettingsDialog";
import { CaptureDialog } from "./components/CaptureDialog";
import { createProject } from "./domain/project";
import { useExportQueue } from "./hooks/use-export-queue";
import { ExportTray } from "./components/ExportTray";
export function App() {
  const t = useT();
  const [timelineMode, setTimelineMode] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(24);
  const [preferProxies, setPreferProxies] = useState(false);
  const {
    platform,
    error,
    setError,
    message,
    setMessage,
    busy,
    report,
    editor,
    project,
    current,
    resources,
    mode,
    setMode,
    time,
    setTime,
    playing,
    setPlaying,
    dragging,
    setDragging,
    dialog,
    setDialog,
    mediaInput,
    folderInput,
    replaceAsset,
    musicInput,
    projectInput,
    total,
    selected,
    selectedIndex,
    selectedIds,
    sceneAction,
    selectScene,
    edit,
    editScene,
    deleteSelected,
    duplicateSelected,
    splitSelected,
    moveSelected,
    reorder,
    changeMusic,
    addTitle,
    addMedia,
    importFiles,
    showExample,
    chooseMedia,
    savePortable,
    openSelectedFile,
    requestOpen,
    performTransition,
    undoEdit,
    redoEdit,
    togglePlayback,
    playbackStep,
    modalClose,
    showProjects,
    openSavedProject,
  } = useEditorController();
  const exports = useExportQueue(platform);
  useEffect(() => {
    void platform
      .loadPreferences?.()
      .then((preferences) => {
        setApplicationLocale(preferences.locale);
        setTimelineMode(preferences.timeline);
        setTimelineZoom(preferences.timelineZoom);
        setPreferProxies(preferences.proxyEditing);
        if (preferences.checkUpdates)
          void platform
            .checkForUpdate?.()
            .then((update) => {
              if (update)
                setMessage(
                  `Corto ${update.version} is available in Settings → Updates.`,
                );
            })
            .catch(report);
      })
      .catch(report);
  }, [platform, report, setMessage]);
  return (
    <div
      className="editor-shell"
      data-testid="editor-shell"
      data-backend={platform.kind}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes("Files") && !busy && !dialog)
          setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setDragging(false);
        if (!busy && !dialog) importFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <Header
        projectId={project.id}
        name={project.name}
        onName={(name) => {
          if (name !== current.current.present.name)
            edit((project) => ({ ...project, name }));
        }}
        status={editor.saveStatus}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        busy={!!busy || !editor.loaded}
        canExport={project.scenes.length > 0}
        onUndo={undoEdit}
        onRedo={redoEdit}
        onNew={() => setDialog("new")}
        onOpen={requestOpen}
        onSave={savePortable}
        onExport={() => {
          setPlaying(false);
          setDialog("export");
        }}
        onHelp={() => setDialog("help")}
        onAbout={() => setDialog("about")}
        onProjects={showProjects}
        onSound={() => {
          setPlaying(false);
          setDialog("sound");
        }}
        onSubtitles={() => {
          setPlaying(false);
          setDialog("subtitles");
        }}
        onSlideshow={() => {
          setPlaying(false);
          setDialog("slideshow");
        }}
        onFilmTools={() => setDialog("film-tools")}
        onCapture={() => setDialog("capture")}
        onSettings={() => setDialog("settings")}
      />
      <div className="app-body" inert={!!busy || !editor.loaded}>
        <NavigationRail
          mode={mode}
          onMode={setMode}
          onHelp={() => setDialog("help")}
        />
        <Library
          mode={mode}
          onMode={setMode}
          project={project}
          resources={resources}
          busy={!!busy || !editor.loaded}
          backend={platform.kind}
          onImport={chooseMedia}
          onFolder={() => folderInput.current?.click()}
          onSlideshow={() => setDialog("slideshow")}
          onReplace={replaceAsset}
          onAdd={addMedia}
          onTitle={addTitle}
          onExample={showExample}
          onHelp={() => setDialog("help")}
          onMusic={changeMusic}
          onSound={() => {
            setPlaying(false);
            setDialog("sound");
          }}
          onSubtitles={() => {
            setPlaying(false);
            setDialog("subtitles");
          }}
        />
        <main className="workspace" aria-label={t("Film editor")}>
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">{t("A LITTLE FILM BY YOU")}</span>
              <h1>
                {project.scenes.length
                  ? project.name
                  : t("Make something worth keeping.")}
              </h1>
            </div>
            <label className="aspect-select">
              <span className="sr-only">{t("Aspect ratio")}</span>
              <select
                aria-label={t("Aspect ratio")}
                value={project.ratio}
                onChange={(event) =>
                  edit((project) => ({
                    ...project,
                    ratio: event.target.value as Project["ratio"],
                  }))
                }
              >
                <option value="landscape">{t("16:9 \u00B7 Landscape")}</option>
                <option value="portrait">{t("9:16 \u00B7 Portrait")}</option>
                <option value="square">{t("1:1 \u00B7 Square")}</option>
                <option value="classic">{t("4:3 \u00B7 Classic")}</option>
                <option value="feed">{t("4:5 \u00B7 Social feed")}</option>
                <option value="cinema">{t("2.35:1 \u00B7 Cinema")}</option>
              </select>
            </label>
          </div>
          <Preview
            preferProxies={preferProxies}
            project={project}
            platform={platform}
            resources={resources}
            time={time}
            playing={playing}
            onTime={setTime}
            onPlaying={setPlaying}
            report={report}
          />
          <div className="playback-controls">
            <span className="time-code">
              <strong>{formatTime(time)}</strong>
              <span>{t("/")}</span>
              {formatTime(total)}
            </span>
            <div className="transport">
              <IconButton
                icon={SkipBack}
                label={t("Previous scene")}
                disabled={!project.scenes.length}
                onClick={() => playbackStep(-1)}
              />
              <IconButton
                icon={playing ? Pause : Play}
                label={t(playing ? "Pause" : "Play")}
                className="play-button"
                disabled={!project.scenes.length}
                onClick={togglePlayback}
              />
              <IconButton
                icon={SkipForward}
                label={t("Next scene")}
                disabled={!project.scenes.length}
                onClick={() => playbackStep(1)}
              />
            </div>
            <span className="preview-note">
              {project.scenes.length
                ? t("Preview")
                : t("Your story starts here")}
            </span>
          </div>
          <input
            className="playhead"
            aria-label={t("Playhead")}
            type="range"
            min="0"
            max={total || 1}
            step="0.01"
            value={time}
            disabled={!project.scenes.length}
            onChange={(event) => {
              setPlaying(false);
              setTime(Number(event.target.value));
            }}
            style={
              {
                "--progress": `${total ? (time / total) * 100 : 0}%`,
              } as CSSProperties
            }
          />
          {!project.scenes.length && (
            <div className="workspace-invitation">
              <button className="button primary" onClick={() => chooseMedia()}>
                <ImagePlus size={16} />
                {t("Bring in your moments")}
              </button>
              <span>{t("or drop photos and clips anywhere")}</span>
            </div>
          )}
        </main>
        <Inspector
          scene={selected}
          asset={selected?.assetId ? project.assets[selected.assetId] : null}
          index={selectedIndex}
          count={project.scenes.length}
          onChange={editScene}
          onDelete={deleteSelected}
          onDuplicate={duplicateSelected}
          onSplit={splitSelected}
          onMove={moveSelected}
          busy={!!busy}
          onTools={() => {
            setPlaying(false);
            setDialog("scene-tools");
          }}
        />
        <Storyboard
          project={project}
          resources={resources}
          selected={selected?.id ?? null}
          time={time}
          playing={playing}
          onSelect={selectScene}
          selectedIds={selectedIds}
          onAction={sceneAction}
          timelineMode={timelineMode}
          zoom={timelineZoom}
          platform={platform}
          onAudioChange={changeMusic}
          onSeek={(at) => {
            setPlaying(false);
            setTime(at);
          }}
          onAddAsset={(id, afterId) => {
            const asset = project.assets[id];
            if (asset) addMedia(asset, afterId);
          }}
          onReorder={reorder}
          onTitle={() => addTitle()}
          onMusic={() => {
            if (project.audioClips.length) {
              setPlaying(false);
              setDialog("sound");
              return;
            }
            setMode("music");
            if (
              !Object.values(project.assets).some(
                (asset) => asset.kind === "audio",
              )
            )
              chooseMedia(true);
          }}
          busy={!!busy}
        />
      </div>
      <input
        hidden
        data-testid="media-input"
        ref={mediaInput}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.bmp,.heic,.heif,.gif,.tif,.tiff,.svg,.mp4,.mov,.m4v,.webm,.wmv,.avi,.mkv,.mts,.m2ts,.3gp,.vob,.mpg,.mpeg,.mp3,.wav,.m4a,.aac,.flac,.ogg,.cube"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length) importFiles(files);
        }}
      />
      <input
        hidden
        data-testid="folder-input"
        ref={(element) => {
          folderInput.current = element;
          element?.setAttribute("webkitdirectory", "");
        }}
        type="file"
        multiple
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length) importFiles(files);
        }}
      />
      <input
        hidden
        data-testid="music-input"
        ref={musicInput}
        type="file"
        accept=".mp3,.wav,.m4a,.aac,.flac,.ogg"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length) {
            setMode("music");
            importFiles(files);
          }
        }}
      />
      <input
        hidden
        data-testid="project-input"
        ref={projectInput}
        type="file"
        accept=".corto"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) openSelectedFile(file);
        }}
      />
      {busy && (
        <div className="busy-indicator" role="status">
          <LoaderCircle size={16} className="spin" />
          {busy}
          {t("\u2026")}
        </div>
      )}
      {message && !busy && (
        <div className="busy-indicator success-notice" role="status">
          <Check size={16} />
          {message}
          <IconButton
            icon={X}
            label={t("Dismiss notification")}
            onClick={() => setMessage(null)}
          />
        </div>
      )}
      {dragging && (
        <div className="drop-overlay">
          <div>
            <Plus size={36} />
            <strong>{t("Drop a little life in.")}</strong>
            <span>{t("Photos, clips, music. Your story.")}</span>
          </div>
        </div>
      )}
      {error && (
        <div className="error-notice" role="alert">
          <CircleAlert size={18} />
          <p>{error}</p>
          <IconButton
            icon={X}
            label={t("Dismiss message")}
            onClick={() => setError(null)}
          />
        </div>
      )}
      <EditorDialogs
        renderMovie={exports.renderMovie}
        time={time}
        selectedIds={selectedIds}
        dialog={dialog}
        project={project}
        platform={platform}
        onClose={modalClose}
        onSave={savePortable}
        onTransition={performTransition}
      />
      <ExportTray
        jobs={exports.jobs}
        platform={platform}
        onCancel={(id) => exports.queue.cancel(id)}
      />
      {dialog === "scene-tools" && selected && (
        <SceneTools
          preferProxies={preferProxies}
          project={project}
          scene={selected}
          platform={platform}
          onChange={editScene}
          onProject={edit}
          onClose={modalClose}
          report={report}
        />
      )}
      {dialog === "slideshow" && (
        <SlideshowDialog
          project={project}
          platform={platform}
          onCreate={(draft) => {
            editor.replace(draft);
            setTime(0.6);
          }}
          onClose={modalClose}
        />
      )}
      {dialog === "film-tools" && (
        <FilmTools
          project={project}
          selectedIds={selectedIds}
          time={time}
          timelineMode={timelineMode}
          zoom={timelineZoom}
          onTimeline={setTimelineMode}
          onZoom={setTimelineZoom}
          onChange={edit}
          onSeek={setTime}
          onClose={modalClose}
        />
      )}
      {dialog === "settings" && (
        <SettingsDialog
          project={project}
          platform={platform}
          onSave={(preferences) => {
            setApplicationLocale(preferences.locale);
            setTimelineMode(preferences.timeline);
            setTimelineZoom(preferences.timelineZoom);
            setPreferProxies(preferences.proxyEditing);
            edit((current) => ({ ...current, defaults: preferences.defaults }));
          }}
          onClose={modalClose}
        />
      )}
      {dialog === "capture" && (
        <CaptureDialog onImport={importFiles} onClose={modalClose} />
      )}
      {dialog === "projects" && (
        <ProjectHome
          platform={platform}
          onClose={modalClose}
          onOpen={openSavedProject}
          onNew={() => setDialog("new")}
          onPortable={() => {
            setDialog(null);
            requestOpen();
          }}
          onChanged={(changed) => {
            if (changed.id === project.id) edit(() => changed);
          }}
          onDeleted={(id) => {
            if (id === project.id) {
              editor.replace(createProject());
              setTime(0);
            }
          }}
          onRestored={(restored) => {
            editor.replace(restored);
            setTime(0.6);
            modalClose();
          }}
        />
      )}
      {dialog === "sound" && (
        <SoundDialog
          project={project}
          platform={platform}
          time={time}
          onChange={(next) => edit(() => next)}
          onClose={modalClose}
        />
      )}
      {dialog === "subtitles" && (
        <SubtitlesDialog
          platform={platform}
          project={project}
          time={time}
          onChange={(next) => edit(() => next)}
          onClose={modalClose}
        />
      )}
    </div>
  );
}
