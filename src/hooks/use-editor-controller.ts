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
  changeScene,
  createProject,
  createScene,
  isBlankProject,
  moveScene,
  splitScene,
} from "../domain/project";
import { buildTimeline, filmDuration, locateScene } from "../domain/timeline";
import { useProject } from "./use-project";
import { useResources } from "./use-resources";
import { createExampleProject } from "../media/example";
import { importMedia } from "../media/phone";
import { createPlatform } from "../platform";
import { type LibraryMode } from "../components/Library";
import { addMusic } from "../domain/audio";
import {
  changeScenes,
  cloneScenes,
  insertScenes,
  replaceMedia,
  sceneEffects,
  selectScenes,
} from "../domain/editing";

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
    : "That didn't work. Try it again.";
}

/** Coordinate editor state and platform actions without coupling them to layout markup. */
export function useEditorController() {
  const [platform] = useState(createPlatform);

  const [error, setError] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);

  /**
   * The last removal, offered back in a toast. It stays valid only while the
   * film is exactly as the removal left it, so Undo can never reverse
   * something else.
   */
  const [removal, setRemoval] = useState<{
    count: number;
    after: Project;
  } | null>(null);

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectionRef = useRef(selectedIds);
  const validSelection = useMemo(() => {
    const existingSceneIds = new Set(project.scenes.map((scene) => scene.id));
    return new Set([...selectedIds].filter((id) => existingSceneIds.has(id)));
  }, [selectedIds, project.scenes]);
  const anchorRef = useRef<string | null>(null);
  const clipboard = useRef<{
    scenes: Scene[];
    assets: Project["assets"];
  } | null>(null);
  const effectsClipboard = useRef<ReturnType<typeof sceneEffects> | null>(null);

  const [mode, setMode] = useState<LibraryMode>("media");

  const [time, setTime] = useState(0);

  const [playing, setPlaying] = useState(false);

  const [dragging, setDragging] = useState(false);

  const [dialog, setDialog] = useState<EditorDialog>(null);

  const mediaInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const musicInput = useRef<HTMLInputElement>(null);

  const projectInput = useRef<HTMLInputElement>(null);

  const timeline = useMemo(
    () => buildTimeline(project.scenes),
    [project.scenes],
  );

  const total = filmDuration(project.scenes);

  const selected =
    project.scenes.find((scene) => scene.id === selectedId) ??
    project.scenes.find((scene) => validSelection.has(scene.id)) ??
    project.scenes[0] ??
    null;
  const effectiveSelection = useMemo(
    () =>
      validSelection.size || !selected
        ? validSelection
        : new Set([selected.id]),
    [validSelection, selected],
  );
  selectionRef.current = effectiveSelection;

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
    (id: string, options?: { additive?: boolean; range?: boolean }) => {
      const scenes = current.current.present.scenes;
      const nextSelection = selectScenes(
        scenes,
        selectionRef.current,
        id,
        anchorRef.current,
        !!options?.additive,
        !!options?.range,
      );
      // Removing the primary scene keeps the inspector and playhead on a
      // member of the remaining selection.
      const primaryId = nextSelection.has(id)
        ? id
        : (nextSelection.values().next().value ?? id);
      const entry = buildTimeline(scenes).find(
        (item) => item.scene.id === primaryId,
      );
      if (!entry) return;
      setPlaying(false);
      setSelectedId(primaryId);
      setSelectedIds(nextSelection);
      if (!options?.range) anchorRef.current = primaryId;
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
    if (scene) {
      const before = current.current.present.scenes.length;
      edit((project) => ({
        ...project,
        scenes: project.scenes.filter(
          (item) =>
            !(selectionRef.current.size
              ? selectionRef.current.has(item.id)
              : item.id === scene.id),
        ),
      }));
      const after = current.current.present;
      const count = before - after.scenes.length;
      if (count > 0) setRemoval({ count, after });
    }
    setSelectedIds(new Set());
  }, [edit, current]);

  const duplicateSelected = useCallback(() => {
    const scene = selectedRef.current;
    if (!scene) return;
    const chosen = current.current.present.scenes.filter((item) =>
      selectionRef.current.size
        ? selectionRef.current.has(item.id)
        : item.id === scene.id,
    );
    const copies = cloneScenes(chosen);
    edit((project) =>
      insertScenes(project, copies, chosen.at(-1)?.id ?? scene.id),
    );
    if (copies[0]) selectScene(copies[0].id);
  }, [edit, selectScene, current]);

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
    (audioClips: Project["audioClips"]) =>
      edit((project) => ({ ...project, audioClips })),
    [edit],
  );

  const addTitle = useCallback(
    (caption = "Your title here", style: Scene["captionStyle"] = "classic") => {
      const scene = { ...createScene(null), caption, captionStyle: style };
      edit((project) =>
        insertScenes(project, [scene], selectedRef.current?.id ?? null),
      );
      const start =
        buildTimeline(current.current.present.scenes).find(
          (entry) => entry.scene.id === scene.id,
        )?.start ?? 0;
      setSelectedId(scene.id);
      setSelectedIds(new Set([scene.id]));
      setTime(start + 0.6);
    },
    [current, edit],
  );

  const addMedia = useCallback(
    (asset: MediaAsset, afterId?: string) => {
      if (asset.kind === "audio") {
        edit((project) => addMusic(project, asset));
        return;
      }
      if (asset.kind === "lut") return;
      const defaults = current.current.present.defaults;
      const scene = {
        ...createScene(asset),
        fit: defaults.fit,
        transition: defaults.transition,
        transitionSeconds: defaults.transitionSeconds,
        background: defaults.background,
        captionStyle: defaults.titleStyle,
        ...(asset.kind === "image" ? { duration: defaults.photoSeconds } : {}),
      };
      edit((project) =>
        insertScenes(
          project,
          [scene],
          afterId ?? selectedRef.current?.id ?? null,
        ),
      );
      const start =
        buildTimeline(current.current.present.scenes).find(
          (entry) => entry.scene.id === scene.id,
        )?.start ?? 0;
      setSelectedId(scene.id);
      setSelectedIds(new Set([scene.id]));
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
        let insertionAnchor = selectedRef.current?.id ?? null;
        for (const file of files) {
          try {
            setBusy(`Preparing ${file.name}`);
            const { asset, original } = await importMedia(file, platform);
            let candidate = addAsset(
              original ? addAsset(next, original) : next,
              asset,
            );
            if (asset.kind === "audio") candidate = addMusic(candidate, asset);
            else if (asset.kind === "lut") {
              /* Imported looks are selected in Picture tools. */
            } else {
              const defaults = next.defaults;
              const scene = {
                ...createScene(asset),
                fit: defaults.fit,
                transition: defaults.transition,
                transitionSeconds: defaults.transitionSeconds,
                background: defaults.background,
                captionStyle: defaults.titleStyle,
                ...(asset.kind === "image"
                  ? { duration: defaults.photoSeconds }
                  : {}),
              };
              candidate = insertScenes(candidate, [scene], insertionAnchor);
              insertionAnchor = scene.id;
              first ??= scene.id;
            }
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
          setSelectedIds(new Set([first]));
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

  /** Open a whole film with one current scene for the reel, inspector and editing commands. */
  const acceptProject = useCallback(
    (opened: Project) => {
      const first = opened.scenes[0];
      clearResources();
      replace(opened);
      setPlaying(false);
      setSelectedId(first?.id ?? null);
      setSelectedIds(new Set(first ? [first.id] : []));
      anchorRef.current = first?.id ?? null;
      setTime(first ? Math.min(0.6, first.duration / 2) : 0);
      setMode("media");
    },
    [clearResources, replace],
  );
  const showExample = useCallback(() => {
    void task("Opening the example", async () => {
      if (!isBlankProject(current.current.present))
        await platform.saveProject(current.current.present);
      acceptProject(await createExampleProject(platform));
    });
  }, [task, platform, current, acceptProject]);

  const chooseMedia = useCallback(
    (music = false) => (music ? musicInput : mediaInput).current?.click(),
    [],
  );
  const replaceAsset = useCallback(
    (id: string, file: File) => {
      void task("Replacing media", async () => {
        const imported = await importMedia(file, platform);
        commit((project) =>
          replaceMedia(
            addAsset(
              imported.original
                ? addAsset(project, imported.original)
                : project,
              imported.asset,
            ),
            id,
            imported.asset.id,
          ),
        );
      });
    },
    [task, platform, commit],
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

  const openSelectedFile = useCallback(
    (file?: File) => {
      void task("Opening your project", async () => {
        if (!isBlankProject(current.current.present))
          await platform.saveProject(current.current.present);
        const opened = await platform.openPortable(file);
        if (opened) acceptProject(opened);
      });
    },
    [task, platform, current, acceptProject],
  );

  const chooseProject = useCallback(() => {
    if (platform.kind === "native") openSelectedFile();
    else projectInput.current?.click();
  }, [platform, openSelectedFile]);

  // Opening a project saves the current film first (openSelectedFile), so
  // there is nothing to confirm.
  const requestOpen = chooseProject;

  /** A new film starts at once: the current one is already safe in Films. */
  const startNewFilm = useCallback(() => {
    setDialog(null);
    void task("Saving your film", async () => {
      if (!isBlankProject(current.current.present))
        await platform.saveProject(current.current.present);
      const preferences = await platform.loadPreferences?.();
      acceptProject(
        preferences
          ? {
              ...createProject(),
              defaults: preferences.defaults,
              output: preferences.output,
            }
          : createProject(),
      );
      setError(null);
    });
  }, [acceptProject, task, platform, current]);

  const showProjects = useCallback(() => {
    void task("Saving your film", async () => {
      // An untouched film is not worth a place in Films.
      if (
        editor.saveStatus !== "error" &&
        !isBlankProject(current.current.present)
      )
        await platform.saveProject(current.current.present);
      setDialog("projects");
    });
  }, [task, platform, current, editor.saveStatus]);

  const openSavedProject = useCallback(
    (id: string, recover = false) => {
      void task(
        recover ? "Recovering your film" : "Opening your film",
        async () => {
          const opened = await platform.openProject(id, recover);
          await platform.saveProject(opened);
          acceptProject(opened);
          setDialog(null);
          if (recover)
            setMessage(
              "Recovered as a separate film. Your latest edit is still in Films.",
            );
        },
      );
    },
    [task, platform, acceptProject],
  );
  useEffect(
    () =>
      platform.onProjectOpened?.((opened) => {
        void task("Opening the selected Corto file", async () => {
          if (!isBlankProject(current.current.present))
            await platform.saveProject(current.current.present);
          await platform.saveProject(opened);
          acceptProject(opened);
          setDialog(null);
        });
      }),
    [platform, task, current, acceptProject],
  );

  const undoEdit = useCallback(() => {
    setPlaying(false);
    undo();
  }, [undo]);

  const redoEdit = useCallback(() => {
    setPlaying(false);
    redo();
  }, [redo]);

  /** Undo from the removal toast, only while nothing else has changed. */
  const undoRemoval = useCallback(() => {
    setRemoval((offer) => {
      if (offer && current.current.present === offer.after) undoEdit();
      return null;
    });
  }, [current, undoEdit]);
  const dismissRemoval = useCallback(() => setRemoval(null), []);
  const removalOffer =
    removal && removal.after === project ? removal.count : null;

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

  const sceneAction = useCallback(
    (action: string) => {
      const present = current.current.present;
      const ids = selectionRef.current.size
        ? selectionRef.current
        : new Set(selectedRef.current ? [selectedRef.current.id] : []);
      const chosen = present.scenes.filter((scene) => ids.has(scene.id));
      if (action === "copy" || action === "cut") {
        clipboard.current = { scenes: chosen, assets: present.assets };
        if (action === "cut") deleteSelected();
      }
      if (action === "paste" && clipboard.current) {
        const copied = clipboard.current;
        edit((project) =>
          insertScenes(
            { ...project, assets: { ...copied.assets, ...project.assets } },
            cloneScenes(copied.scenes),
            selectedRef.current?.id ?? null,
          ),
        );
      }
      if (action === "duplicate") duplicateSelected();
      if (action === "delete") deleteSelected();
      if (action === "split") splitSelected();
      if (action === "select-all")
        setSelectedIds(new Set(present.scenes.map((scene) => scene.id)));
      if (action === "copy-effects" && chosen[0])
        effectsClipboard.current = sceneEffects(chosen[0]);
      if (action === "paste-effects" && effectsClipboard.current)
        edit((project) =>
          changeScenes(project, ids, (scene) => ({
            ...scene,
            ...effectsClipboard.current,
          })),
        );
    },
    [current, edit, deleteSelected, duplicateSelected, splitSelected],
  );

  const seekByKey = useCallback(
    (key: string) => {
      setPlaying(false);
      const present = current.current.present;
      const total = filmDuration(present.scenes);
      setTime((value) =>
        key === "Home"
          ? 0
          : key === "End"
            ? total
            : Math.max(
                0,
                Math.min(
                  total,
                  value +
                    (key === "ArrowRight" ? 1 : -1) /
                      (typeof present.output.fps === "number"
                        ? present.output.fps
                        : 30),
                ),
              ),
      );
    },
    [current],
  );

  useEditorShortcuts({
    state: ui,
    savePortable,
    requestOpen,
    redoEdit,
    undoEdit,
    togglePlayback,
    deleteSelected,
    moveSelected,
    sceneAction,
    seekByKey,
  });

  const modalClose = useCallback(() => setDialog(null), []);
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
    folderInput,
    replaceAsset,
    musicInput,
    projectInput,
    total,
    selected,
    selectedIndex,
    selectedIds: effectiveSelection,
    acceptProject,
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
    startNewFilm,
    undoEdit,
    redoEdit,
    removalOffer,
    undoRemoval,
    dismissRemoval,
    togglePlayback,
    playbackStep,
    modalClose,
    showProjects,
    openSavedProject,
  };
}
