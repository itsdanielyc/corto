import { type CSSProperties } from "react";
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

export function App() {
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
    musicInput,
    projectInput,
    total,
    selected,
    selectedIndex,
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
        <main className="workspace" aria-label="Film editor">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">A LITTLE FILM BY YOU</span>
              <h1>
                {project.scenes.length
                  ? project.name
                  : "Make something worth keeping."}
              </h1>
            </div>
            <label className="aspect-select">
              <span className="sr-only">Aspect ratio</span>
              <select
                aria-label="Aspect ratio"
                value={project.ratio}
                onChange={(event) =>
                  edit((project) => ({
                    ...project,
                    ratio: event.target.value as Project["ratio"],
                  }))
                }
              >
                <option value="landscape">16:9 · Landscape</option>
                <option value="portrait">9:16 · Portrait</option>
                <option value="square">1:1 · Square</option>
              </select>
            </label>
          </div>
          <Preview
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
              <span>/</span>
              {formatTime(total)}
            </span>
            <div className="transport">
              <IconButton
                icon={SkipBack}
                label="Previous scene"
                disabled={!project.scenes.length}
                onClick={() => playbackStep(-1)}
              />
              <IconButton
                icon={playing ? Pause : Play}
                label={playing ? "Pause" : "Play"}
                className="play-button"
                disabled={!project.scenes.length}
                onClick={togglePlayback}
              />
              <IconButton
                icon={SkipForward}
                label="Next scene"
                disabled={!project.scenes.length}
                onClick={() => playbackStep(1)}
              />
            </div>
            <span className="preview-note">
              {project.scenes.length ? "Preview" : "Your story starts here"}
            </span>
          </div>
          <input
            className="playhead"
            aria-label="Playhead"
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
                Bring in your moments
              </button>
              <span>or drop photos and clips anywhere</span>
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
        />
        <Storyboard
          project={project}
          resources={resources}
          selected={selected?.id ?? null}
          time={time}
          playing={playing}
          onSelect={selectScene}
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
        accept=".jpg,.jpeg,.png,.webp,.bmp,.heic,.heif,.mp4,.mov,.m4v,.webm,.mp3,.wav,.m4a,.aac,.flac,.ogg"
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
          {busy}…
        </div>
      )}
      {message && !busy && (
        <div className="busy-indicator success-notice" role="status">
          <Check size={16} />
          {message}
          <IconButton
            icon={X}
            label="Dismiss notification"
            onClick={() => setMessage(null)}
          />
        </div>
      )}
      {dragging && (
        <div className="drop-overlay">
          <div>
            <Plus size={36} />
            <strong>Drop a little life in.</strong>
            <span>Photos, clips, music. Your story.</span>
          </div>
        </div>
      )}
      {error && (
        <div className="error-notice" role="alert">
          <CircleAlert size={18} />
          <p>{error}</p>
          <IconButton
            icon={X}
            label="Dismiss message"
            onClick={() => setError(null)}
          />
        </div>
      )}
      <EditorDialogs
        dialog={dialog}
        project={project}
        platform={platform}
        onClose={modalClose}
        onSave={savePortable}
        onTransition={performTransition}
      />
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
          project={project}
          time={time}
          onChange={(next) => edit(() => next)}
          onClose={modalClose}
        />
      )}
    </div>
  );
}
