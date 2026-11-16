import { useEditorShortcuts } from "./use-editor-shortcuts";
import type { EditorDialog } from "../components/EditorDialogs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LIMITS,
  type MediaAsset,
  type Project,
  type Scene,
} from "../../contracts/project";
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
} from "../domain/project";
import { buildTimeline, filmDuration, locateScene } from "../domain/timeline";
import { useProject } from "./use-project";
import { useResources } from "./use-resources";
import { createExampleProject } from "../media/example";
import { inspectFile } from "../media/import";
import { createPlatform } from "../platform";
import { type LibraryMode } from "../components/Library";

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

/** Coordinate editor state and platform actions without coupling them to layout markup. */
export function useEditorController() {
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

  const [dialog, setDialog] = useState<EditorDialog>(null);

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

  useEditorShortcuts({
    state: ui,
    savePortable,
    requestOpen,
    redoEdit,
    undoEdit,
    togglePlayback,
    deleteSelected,
    moveSelected,
  });

  const modalClose = () => setDialog(null);
  return {
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
  };
}
