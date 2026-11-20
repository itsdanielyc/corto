import { useT } from "./i18n/locale";
import { setApplicationLocale } from "./i18n/locale";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleAlert,
  Images,
  LoaderCircle,
  Music2,
  SlidersHorizontal,
  Type,
  X,
} from "lucide-react";
import type { Project, Scene } from "../contracts/project";
import { Header } from "./components/Header";
import { Library } from "./components/Library";
import { Inspector, type InspectorTab } from "./components/Inspector";
import { Stage } from "./components/Stage";
import { StageOverlay } from "./components/StageOverlay";
import { Storyboard } from "./components/Storyboard";
import { IconButton } from "./components/primitives";
import { useEditorController } from "./hooks/use-editor-controller";
import { EditorDialogs } from "./components/EditorDialogs";
import { ProjectHome, type TemplateTheme } from "./components/ProjectHome";
import { SoundDialog } from "./components/SoundDialog";
import { SubtitlesDialog } from "./components/SubtitlesDialog";
import { SlideshowDialog } from "./components/SlideshowDialog";
import { FilmTools } from "./components/FilmTools";
import { SettingsDialog } from "./components/SettingsDialog";
import { CaptureDialog } from "./components/CaptureDialog";
import { CommandPalette } from "./components/CommandPalette";
import { useEditorCommands } from "./components/editor-commands";
import { addAsset, changeScene, createProject } from "./domain/project";
import { changeScenes } from "./domain/editing";
import { buildProjectTemplate, THEMES } from "./domain/slideshow";
import { bundledSoundFile } from "./media/bundled-sounds";
import { inspectFile } from "./media/import";
import { useExportQueue } from "./hooks/use-export-queue";
import { ExportTray } from "./components/ExportTray";
import { describeDrop } from "./components/drop-summary";
import { loadTheme } from "./components/theme";

/** Phone layouts show one of these as a bottom sheet over the reel. */
type PhoneSheet = "edit" | "library" | null;

export function App() {
  const t = useT();
  const [timelineMode, setTimelineMode] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(24);
  const [preferProxies, setPreferProxies] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("look");
  const [palette, setPalette] = useState(false);
  const [framing, setFraming] = useState(false);
  const [sheet, setSheet] = useState<PhoneSheet>(null);
  const [dropSummary, setDropSummary] = useState("");
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
  const running = exports.jobs.find((job) => job.status === "running");
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
  useEffect(() => {
    void platform.setNativeTheme?.(loadTheme()).catch(report);
  }, [platform, report]);
  // Framing belongs to one photo; leave it when the selection moves on.
  useEffect(() => setFraming(false), [selected?.id]);
  const pause = useCallback(() => setPlaying(false), [setPlaying]);
  const openPanel = useCallback(
    (panel: "sound" | "subtitles" | "film-tools") => {
      pause();
      setDialog(panel);
      setSheet(null);
    },
    [pause, setDialog],
  );
  const addTitleCard = useCallback(
    (caption?: string, style?: Scene["captionStyle"]) => {
      addTitle(caption, style);
      setInspectorTab("text");
    },
    [addTitle],
  );
  const startTemplate = useCallback(
    async (theme: TemplateTheme) => {
      try {
        const file = await bundledSoundFile(THEMES[theme].music);
        const { asset } = await inspectFile(file);
        await platform.putAsset(asset, file);
        const draft = buildProjectTemplate(
          { ...addAsset(createProject(), asset), id: crypto.randomUUID() },
          theme,
          "",
          asset.id,
        );
        draft.name = t(THEMES[theme].name);
        draft.scenes = draft.scenes.map((scene) => ({
          ...scene,
          caption: t(scene.caption),
        }));
        const present = current.current.present;
        if (present.scenes.length || Object.keys(present.assets).length)
          await platform.saveProject(present);
        editor.replace(draft);
        setTime(0.6);
        setDialog(null);
      } catch (failure) {
        report(failure);
      }
    },
    [platform, t, current, editor, setTime, setDialog, report],
  );
  const commands = useEditorCommands({
    project,
    selected,
    playing,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    timelineMode,
    actions: {
      togglePlayback,
      undo: undoEdit,
      redo: redoEdit,
      importMedia: () => chooseMedia(),
      importMusic: () => chooseMedia(true),
      importFolder: () => folderInput.current?.click(),
      addTitle: () => addTitleCard(),
      exportMovie: () => {
        pause();
        setDialog("export");
      },
      sound: () => openPanel("sound"),
      subtitles: () => openPanel("subtitles"),
      filmTools: () => openPanel("film-tools"),
      slideshow: () => {
        pause();
        setDialog("slideshow");
      },
      films: showProjects,
      newFilm: () => setDialog("new"),
      open: requestOpen,
      save: savePortable,
      settings: () => setDialog("settings"),
      capture: () => setDialog("capture"),
      help: () => setDialog("help"),
      about: () => setDialog("about"),
      timeline: setTimelineMode,
      ratio: (ratio) => edit((value) => ({ ...value, ratio })),
      tab: setInspectorTab,
      transition: (transition) => editScene({ transition }),
      sceneAction,
      frame: () => setFraming(true),
    },
  });
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        if (!busy) setPalette(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [busy]);
  const modal = dialog && !["sound", "subtitles", "film-tools"].includes(dialog);
  const bulk = selectedIds.size > 1;
  const panel = useMemo(() => {
    if (dialog === "sound")
      return (
        <SoundDialog
          project={project}
          platform={platform}
          time={time}
          onChange={(next) => edit(() => next)}
          onClose={modalClose}
        />
      );
    if (dialog === "subtitles")
      return (
        <SubtitlesDialog
          platform={platform}
          project={project}
          time={time}
          onChange={(next) => edit(() => next)}
          onClose={modalClose}
        />
      );
    if (dialog === "film-tools" || (bulk && !dialog))
      return (
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
          onClose={() => {
            modalClose();
            if (bulk && selected) selectScene(selected.id);
          }}
        />
      );
    return null;
  }, [
    dialog,
    bulk,
    project,
    platform,
    time,
    edit,
    modalClose,
    selectedIds,
    timelineMode,
    timelineZoom,
    setTime,
    selected,
    selectScene,
  ]);
  const home = dialog === "projects";
  const locked = !!busy || !editor.loaded;
  return (
    <div
      className="editor-shell"
      data-testid="editor-shell"
      data-backend={platform.kind}
      data-view={home ? "home" : "editor"}
      data-sheet={panel ? "panel" : (sheet ?? undefined)}
      data-frame={platform.windowFrame}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes("Files") && !busy && !modal) {
          setDropSummary(describeDrop(event.dataTransfer.items, t));
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setDragging(false);
        if (!busy && !modal) importFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <Header
        projectId={project.id}
        name={project.name}
        onName={(name) => {
          if (name !== current.current.present.name)
            edit((value) => ({ ...value, name }));
        }}
        status={editor.saveStatus}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        busy={locked}
        canExport={project.scenes.length > 0}
        frame={platform.windowFrame}
        exportProgress={running ? running.progress.fraction : null}
        onUndo={undoEdit}
        onRedo={redoEdit}
        onNew={() => setDialog("new")}
        onOpen={requestOpen}
        onSave={savePortable}
        onExport={() => {
          pause();
          setDialog("export");
        }}
        onHelp={() => setDialog("help")}
        onAbout={() => setDialog("about")}
        onProjects={showProjects}
        onSound={() => openPanel("sound")}
        onSubtitles={() => openPanel("subtitles")}
        onSlideshow={() => {
          pause();
          setDialog("slideshow");
        }}
        onFilmTools={() => openPanel("film-tools")}
        onCapture={() => setDialog("capture")}
        onSettings={() => setDialog("settings")}
        onCommands={() => setPalette(true)}
      />
      {home ? (
        <ProjectHome
          platform={platform}
          currentId={project.id}
          onClose={modalClose}
          onOpen={openSavedProject}
          onNew={() => setDialog("new")}
          onPortable={() => {
            setDialog(null);
            requestOpen();
          }}
          onSlideshow={() => setDialog("slideshow")}
          onTemplate={(theme) => {
            void startTemplate(theme);
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
      ) : (
        <div className="app-body" inert={locked}>
          <Library
            mode={mode}
            onMode={setMode}
            project={project}
            resources={resources}
            busy={locked}
            backend={platform.kind}
            onImport={chooseMedia}
            onFolder={() => folderInput.current?.click()}
            onSlideshow={() => {
              pause();
              setDialog("slideshow");
            }}
            onReplace={replaceAsset}
            onAdd={addMedia}
            onTitle={addTitleCard}
            onMusic={changeMusic}
            onSound={() => openPanel("sound")}
            onSubtitles={() => openPanel("subtitles")}
          />
          <Stage
            project={project}
            platform={platform}
            resources={resources}
            preferProxies={preferProxies}
            time={time}
            total={total}
            playing={playing}
            busy={locked}
            onTime={setTime}
            onPlaying={setPlaying}
            onTogglePlayback={togglePlayback}
            onStep={playbackStep}
            onRatio={(ratio: Project["ratio"]) =>
              edit((value) => ({ ...value, ratio }))
            }
            onImport={() => chooseMedia()}
            onExample={showExample}
            report={report}
            overlay={
              selected && !playing ? (
                <StageOverlay
                  project={project}
                  scene={selected}
                  time={time}
                  framing={framing}
                  platform={platform}
                  onChange={editScene}
                  onFramingDone={() => setFraming(false)}
                />
              ) : null
            }
          />
          {panel ?? (
            <Inspector
              project={project}
              scene={selected}
              asset={
                selected?.assetId ? project.assets[selected.assetId] : null
              }
              index={selectedIndex}
              count={project.scenes.length}
              resources={resources}
              platform={platform}
              time={time}
              tab={inspectorTab}
              onTab={setInspectorTab}
              onChange={editScene}
              onProject={edit}
              onDelete={deleteSelected}
              onDuplicate={duplicateSelected}
              onSplit={splitSelected}
              onMove={moveSelected}
              onFrame={() => {
                pause();
                setFraming(true);
                setSheet(null);
              }}
              report={report}
              busy={!!busy}
            />
          )}
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
            onTimelineMode={setTimelineMode}
            zoom={timelineZoom}
            onZoom={setTimelineZoom}
            platform={platform}
            onAudioChange={changeMusic}
            onSeek={(at) => {
              pause();
              setTime(at);
            }}
            onAddAsset={(id, afterId) => {
              const asset = project.assets[id];
              if (asset) addMedia(asset, afterId);
            }}
            onReorder={reorder}
            onTitle={() => addTitleCard()}
            onSceneChange={(id, changes) =>
              edit((value) => changeScene(value, id, changes))
            }
            onAllTransitions={(transition, transitionSeconds) =>
              edit((value) =>
                changeScenes(
                  value,
                  new Set(value.scenes.slice(0, -1).map((scene) => scene.id)),
                  (scene) => ({ ...scene, transition, transitionSeconds }),
                ),
              )
            }
            onMusic={() => {
              if (project.audioClips.length) {
                openPanel("sound");
                return;
              }
              setMode("music");
              setSheet("library");
              if (
                !Object.values(project.assets).some(
                  (asset) => asset.kind === "audio",
                )
              )
                chooseMedia(true);
            }}
            busy={!!busy}
          />
          <nav className="phone-tabs" aria-label={t("Editor sections")}>
            {(
              [
                ["edit", "Edit", SlidersHorizontal],
                ["media", "Media", Images],
                ["sound", "Sound", Music2],
                ["text", "Text", Type],
              ] as const
            ).map(([id, label, Icon]) => {
              const pressed =
                id === "edit"
                  ? sheet === "edit"
                  : id === "sound"
                    ? dialog === "sound"
                    : sheet === "library" &&
                      mode === (id === "text" ? "titles" : "media");
              return (
                <button
                  key={id}
                  aria-pressed={pressed}
                  onClick={() => {
                    if (pressed) {
                      if (id === "sound") modalClose();
                      setSheet(null);
                      return;
                    }
                    if (dialog && !modal) modalClose();
                    if (id === "sound") openPanel("sound");
                    else if (id === "edit") setSheet("edit");
                    else {
                      setMode(id === "text" ? "titles" : "media");
                      setSheet("library");
                    }
                  }}
                >
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  {t(label)}
                </button>
              );
            })}
          </nav>
          {sheet && !panel && (
            <button
              className="sheet-scrim"
              aria-label={t("Close sheet")}
              onClick={() => setSheet(null)}
            />
          )}
        </div>
      )}
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
      <div className="notices">
        {busy && (
          <div className="toast busy-indicator" role="status">
            <LoaderCircle size={16} className="spin" aria-hidden="true" />
            {busy}
            {t("…")}
          </div>
        )}
        {message && !busy && (
          <div className="toast success-notice" role="status">
            <Check size={16} aria-hidden="true" />
            <span>{message}</span>
            <IconButton
              icon={X}
              label={t("Dismiss notification")}
              onClick={() => setMessage(null)}
            />
          </div>
        )}
        {error && (
          <div className="toast error-notice" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <p>{error}</p>
            <IconButton
              icon={X}
              label={t("Dismiss message")}
              onClick={() => setError(null)}
            />
          </div>
        )}
      </div>
      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-card">
            <strong>{dropSummary || t("Drop to add to your film")}</strong>
            <span>{t("Photos, clips and music")}</span>
          </div>
        </div>
      )}
      <EditorDialogs
        renderMovie={exports.renderMovie}
        time={time}
        selectedIds={selectedIds}
        dialog={dialog}
        project={project}
        platform={platform}
        resources={resources}
        onClose={modalClose}
        onSave={savePortable}
        onTransition={performTransition}
      />
      <ExportTray
        jobs={exports.jobs}
        platform={platform}
        onCancel={(id) => exports.queue.cancel(id)}
      />
      {palette && (
        <CommandPalette
          commands={commands}
          onClose={() => setPalette(false)}
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
      {dialog === "settings" && (
        <SettingsDialog
          project={project}
          platform={platform}
          onSave={(preferences) => {
            setApplicationLocale(preferences.locale);
            setTimelineMode(preferences.timeline);
            setTimelineZoom(preferences.timelineZoom);
            setPreferProxies(preferences.proxyEditing);
            edit((value) => ({ ...value, defaults: preferences.defaults }));
          }}
          onClose={modalClose}
        />
      )}
      {dialog === "capture" && (
        <CaptureDialog onImport={importFiles} onClose={modalClose} />
      )}
    </div>
  );
}
