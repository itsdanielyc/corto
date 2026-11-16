import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  ImagePlus,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import packageInfo from "../package.json";
import {
  LIMITS,
  type MediaAsset,
  type Project,
  type Scene,
} from "../contracts/project";
import {
  addAsset,
  appendScene,
  changeScene,
  createProject,
  createScene,
  duplicateScene,
  moveScene,
  removeScene,
  splitScene,
} from "./domain/project";
import {
  buildTimeline,
  filmDuration,
  formatTime,
  locateScene,
} from "./domain/timeline";
import { useProject } from "./hooks/use-project";
import { useResources } from "./hooks/use-resources";
import { createExampleProject } from "./media/example";
import { inspectFile } from "./media/import";
import { createPlatform } from "./platform";
import { Header } from "./components/Header";
import {
  Library,
  NavigationRail,
  type LibraryMode,
} from "./components/Library";
import { Inspector } from "./components/Inspector";
import { Preview } from "./components/Preview";
import { Storyboard } from "./components/Storyboard";
import { ExportDialog } from "./components/ExportDialog";
import { IconButton, Modal } from "./components/primitives";

function readableError(error: unknown): string {
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return "Your browser is out of space. Save a portable copy before clearing any local data.";
  if (
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray(error.issues)
  )
    return `That edit could not be saved: ${error.issues[0]?.message ?? "invalid project data"}`;
  return error instanceof Error
    ? error.message.replace(
        /^Error invoking remote method '[^']+': Error: /,
        "",
      )
    : "Something could not be completed. Please try again.";
}

export function App() {
  const [platform] = useState(createPlatform);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const report = useCallback(
    (failure: unknown) => setError(readableError(failure)),
    [],
  );
  const editor = useProject(platform, report, busy !== null);
  const { project, current, commit, replace, undo, redo } = editor;
  const { resources, clear: clearResources } = useResources(
    platform,
    project.assets,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<LibraryMode>("media");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dialog, setDialog] = useState<
    "new" | "open" | "help" | "about" | "export" | null
  >(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const musicInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const timeline = useMemo(
    () => buildTimeline(project.scenes),
    [project.scenes],
  );
  const total = filmDuration(project.scenes);
  const selected =
    project.scenes.find((scene) => scene.id === selectedId) ??
    project.scenes[0] ??
    null;
  const selectedIndex = selected ? project.scenes.indexOf(selected) : -1;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const timeRef = useRef(time);
  timeRef.current = time;
  const ui = useRef({
    busy,
    dialog,
    playing,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
  });
  ui.current = {
    busy,
    dialog,
    playing,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
  };

  useEffect(() => {
    setTime((previous) => Math.min(previous, total));
  }, [total]);

  const selectScene = useCallback(
    (id: string) => {
      const entry = buildTimeline(current.current.present.scenes).find(
        (item) => item.scene.id === id,
      );
      if (!entry) return;
      setPlaying(false);
      setSelectedId(id);
      setTime(entry.start + Math.min(0.6, entry.scene.duration / 2));
    },
    [current],
  );

  const edit = useCallback(
    (operation: (project: Project) => Project) => {
      setPlaying(false);
      commit(operation);
    },
    [commit],
  );
  const editScene = useCallback(
    (changes: Partial<Scene>) => {
      const scene = selectedRef.current;
      if (!scene) return;
      edit((project) => changeScene(project, scene.id, changes));
      const atPlayhead = locateScene(
        buildTimeline(current.current.present.scenes),
        timeRef.current,
      );
      if (atPlayhead?.scene.id !== scene.id) selectScene(scene.id);
    },
    [edit, current, selectScene],
  );
  const deleteSelected = useCallback(() => {
    const scene = selectedRef.current;
    if (scene) edit((project) => removeScene(project, scene.id));
  }, [edit]);
  const duplicateSelected = useCallback(() => {
    const scene = selectedRef.current;
    if (!scene) return;
    const id = crypto.randomUUID();
    edit((project) => duplicateScene(project, scene.id, id));
    selectScene(id);
  }, [edit, selectScene]);
  const splitSelected = useCallback(() => {
    const scene = selectedRef.current;
    if (!scene) return;
    const location = locateScene(
      buildTimeline(current.current.present.scenes),
      timeRef.current,
    );
    const offset =
      location?.scene.id === scene.id &&
      location.localTime >= LIMITS.minimumSceneSeconds &&
      scene.duration - location.localTime >= LIMITS.minimumSceneSeconds
        ? location.localTime
        : scene.duration / 2;
    edit((project) => splitScene(project, scene.id, offset));
  }, [current, edit]);
  const moveSelected = useCallback(
    (direction: number) => {
      const scene = selectedRef.current;
      if (scene)
        edit((project) =>
          moveScene(
            project,
            scene.id,
            project.scenes.findIndex((item) => item.id === scene.id) +
              direction,
          ),
        );
      if (scene) selectScene(scene.id);
    },
    [edit, selectScene],
  );
  const reorder = useCallback(
    (id: string, index: number) => {
      edit((project) => moveScene(project, id, index));
      selectScene(id);
    },
    [edit, selectScene],
  );
  const changeMusic = useCallback(
    (music: Project["music"]) => edit((project) => ({ ...project, music })),
    [edit],
  );
  const addTitle = useCallback(
    (caption = "Your title here", style: Scene["captionStyle"] = "classic") => {
      const scene = { ...createScene(null), caption, captionStyle: style };
      const start = filmDuration(current.current.present.scenes);
      edit((project) => appendScene(project, scene));
      setSelectedId(scene.id);
      setTime(start + 0.6);
    },
    [current, edit],
  );
  const addMedia = useCallback(
    (asset: MediaAsset) => {
      if (asset.kind === "audio") {
        changeMusic({ assetId: asset.id, volume: 0.5, loop: true });
        return;
      }
      const scene = createScene(asset);
      const start = filmDuration(current.current.present.scenes);
      edit((project) => appendScene(project, scene));
      setSelectedId(scene.id);
      setTime(start + Math.min(0.6, scene.duration / 2));
    },
    [current, edit, changeMusic],
  );

  const task = useCallback(
    async (label: string, operation: () => Promise<void>) => {
      if (ui.current.busy) return;
      setBusy(label);
      setPlaying(false);
      setError(null);
      setMessage(null);
      try {
        await operation();
      } catch (failure) {
        report(failure);
      } finally {
        setBusy(null);
      }
    },
    [report],
  );

  const importFiles = useCallback(
    (files: File[]) => {
      void task("Importing your moments", async () => {
        let next = current.current.present;
        let first: string | null = null;
        const failures: string[] = [];
        for (const file of files) {
          try {
            const { asset } = await inspectFile(file);
            let candidate = addAsset(next, asset);
            if (asset.kind === "audio")
              candidate = {
                ...candidate,
                music: { assetId: asset.id, volume: 0.5, loop: true },
              };
            else {
              const scene = createScene(asset);
              candidate = appendScene(candidate, scene);
              first ??= scene.id;
            }
            await platform.putAsset(asset, file);
            next = candidate;
          } catch (failure) {
            failures.push(readableError(failure));
          }
        }
        if (next !== current.current.present) commit(() => next);
        if (first) {
          const location = buildTimeline(next.scenes).find(
            (entry) => entry.scene.id === first,
          )!;
          setSelectedId(first);
          setTime(location.start + Math.min(0.6, location.scene.duration / 2));
        }
        if (failures.length)
          report(
            new Error(
              failures.slice(0, 3).join("\n") +
                (failures.length > 3
                  ? `\n${failures.length - 3} more files could not be imported.`
                  : ""),
            ),
          );
      });
    },
    [task, current, commit, platform, report],
  );

  const showExample = useCallback(() => {
    void task("Opening the example", async () => {
      const example = await createExampleProject(platform);
      clearResources();
      replace(example);
      setSelectedId(example.scenes[0].id);
      setTime(0.6);
      setMode("media");
    });
  }, [task, platform, clearResources, replace]);
  const chooseMedia = useCallback(
    (music = false) => (music ? musicInput : mediaInput).current?.click(),
    [],
  );
  const savePortable = useCallback(() => {
    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    )
      document.activeElement.blur();
    void task("Saving a portable copy", async () => {
      if (await platform.savePortable(current.current.present))
        setMessage("Portable copy saved.");
    });
  }, [task, platform, current]);
  const acceptProject = useCallback(
    (opened: Project) => {
      clearResources();
      replace(opened);
      setSelectedId(opened.scenes[0]?.id ?? null);
      setTime(
        opened.scenes.length ? Math.min(0.6, opened.scenes[0].duration / 2) : 0,
      );
      setMode("media");
    },
    [clearResources, replace],
  );
  const openSelectedFile = useCallback(
    (file?: File) => {
      void task("Opening your project", async () => {
        const opened = await platform.openPortable(file);
        if (opened) acceptProject(opened);
      });
    },
    [task, platform, acceptProject],
  );
  const chooseProject = useCallback(() => {
    if (platform.kind === "native") openSelectedFile();
    else projectInput.current?.click();
  }, [platform, openSelectedFile]);
  const requestOpen = useCallback(() => {
    if (current.current.present.scenes.length) setDialog("open");
    else chooseProject();
  }, [current, chooseProject]);
  const performTransition = useCallback(() => {
    const action = ui.current.dialog;
    setDialog(null);
    if (action === "open") chooseProject();
    else {
      clearResources();
      replace(createProject());
      setSelectedId(null);
      setTime(0);
      setError(null);
    }
  }, [chooseProject, clearResources, replace]);
  const undoEdit = useCallback(() => {
    setPlaying(false);
    undo();
  }, [undo]);
  const redoEdit = useCallback(() => {
    setPlaying(false);
    redo();
  }, [redo]);
  const togglePlayback = useCallback(() => {
    if (!current.current.present.scenes.length) return;
    if (timeRef.current >= filmDuration(current.current.present.scenes))
      setTime(0);
    setPlaying((value) => !value);
  }, [current]);
  const playbackStep = (direction: number) => {
    const location = locateScene(timeline, time);
    const entry =
      timeline[
        Math.max(
          0,
          Math.min(timeline.length - 1, (location?.index ?? 0) + direction),
        )
      ];
    if (entry) selectScene(entry.scene.id);
  };

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        ui.current.busy ||
        ui.current.dialog ||
        document.querySelector("dialog[open]")
      )
        return;
      const editable =
        event.target instanceof HTMLElement &&
        (event.target.matches("input,textarea,select") ||
          event.target.isContentEditable);
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        savePortable();
      } else if (modifier && event.key.toLowerCase() === "o") {
        event.preventDefault();
        requestOpen();
      } else if (!editable && modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoEdit();
        else undoEdit();
      } else if (!editable && modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoEdit();
      } else if (!editable && event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) togglePlayback();
      } else if (
        !editable &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        deleteSelected();
      } else if (!editable && event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        moveSelected(-1);
      } else if (!editable && event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        moveSelected(1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [
    savePortable,
    requestOpen,
    redoEdit,
    undoEdit,
    togglePlayback,
    deleteSelected,
    moveSelected,
  ]);

  const modalClose = () => setDialog(null);
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
        accept=".jpg,.jpeg,.png,.webp,.bmp,.mp4,.mov,.m4v,.webm,.mp3,.wav,.m4a,.aac,.flac,.ogg"
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
      {(dialog === "new" || dialog === "open") && (
        <Modal
          title={
            dialog === "new" ? "Start a new film?" : "Open another project?"
          }
          onClose={modalClose}
        >
          <p className="modal-introduction">
            Save a portable copy if you want to return to this film. Your source
            files stay safe.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={modalClose}>
              Cancel
            </button>
            <button className="button secondary" onClick={savePortable}>
              Save a copy
            </button>
            <button className="button primary" onClick={performTransition}>
              {dialog === "new" ? "Start new film" : "Choose project"}
            </button>
          </div>
        </Modal>
      )}
      {dialog === "help" && (
        <Modal title="A few helpful shortcuts." onClose={modalClose}>
          <p className="modal-introduction">Keep your hands on the story.</p>
          <dl className="shortcuts">
            {[
              ["Play / pause", "Space"],
              ["Undo", "⌘ / Ctrl Z"],
              ["Redo", "⌘ / Ctrl Shift Z"],
              ["Save a portable copy", "⌘ / Ctrl S"],
              ["Open a project", "⌘ / Ctrl O"],
              ["Delete selected scene", "Delete"],
              ["Move selected scene", "Alt ← / →"],
            ].map(([label, key]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <kbd>{key}</kbd>
                </dd>
              </div>
            ))}
          </dl>
          <p className="help-note">
            Drag scenes to reorder them. Your latest edits save locally. Use a
            portable copy to move a project to another device.
          </p>
        </Modal>
      )}
      {dialog === "about" && (
        <Modal
          title="Small films. Lasting memories."
          onClose={modalClose}
          className="about-dialog"
        >
          <img
            src={`${import.meta.env.BASE_URL}brand/corto-lockup-black.svg`}
            alt="Corto"
          />
          <p className="modal-introduction">
            Corto by miille · {packageInfo.version}
            <br />A home for your photos, clips, music and stories.
          </p>
          <p>
            <ShieldCheck size={16} />
            No account. No uploads. No watermark.
          </p>
          <p className="help-note">
            Desktop: local MP4 export with FFmpeg. Web: recording format depends
            on your browser. Browser storage can be cleared by your browser;
            keep a portable .corto copy of films you want to preserve.
          </p>
          <details>
            <summary>Example media & acknowledgements</summary>
            <p>
              Photography: Finge Holden, Dawid Tkocz and Roger Benz, used under
              the Unsplash License. “Quiet morning” is original CC0 music. Corto
              uses Electron, React, Manrope, DM Serif Display, Lucide and
              FFmpeg; third-party notices and source information ship with the
              desktop application.
            </p>
          </details>
          <a
            href="https://github.com/itsdanielyc/corto"
            target="_blank"
            rel="noreferrer"
            className="text-button"
          >
            Source code & releases
            <ArrowRight size={14} />
          </a>
        </Modal>
      )}
      {dialog === "export" && (
        <ExportDialog
          project={project}
          platform={platform}
          onClose={modalClose}
        />
      )}
    </div>
  );
}
