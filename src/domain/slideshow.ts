import {
  parseProject,
  type MediaAsset,
  type Project,
  type Scene,
} from "../../contracts/project";
import { createScene } from "./project";
import { filmDuration } from "./timeline";

export const THEMES = {
  family: {
    name: "Family album",
    background: "#151517",
    style: "classic",
    transition: "dissolve",
    seconds: 0.6,
  },
  holiday: {
    name: "Holiday",
    background: "#183d45",
    style: "modern",
    transition: "slide-left",
    seconds: 0.5,
  },
  birthday: {
    name: "Birthday",
    background: "#69294e",
    style: "modern",
    transition: "zoom",
    seconds: 0.4,
  },
  memorial: {
    name: "In loving memory",
    background: "#24252a",
    style: "classic",
    transition: "dissolve",
    seconds: 1,
  },
  wedding: {
    name: "Wedding",
    background: "#e8e5dd",
    style: "classic",
    transition: "fade-white",
    seconds: 0.8,
  },
} as const;
export interface SlideshowOptions {
  assetIds: string[];
  theme: keyof typeof THEMES;
  order: "selection" | "name" | "date";
  seconds: number;
  motion: boolean;
  dateCaptions: boolean;
  fitSeconds?: number;
  title: string;
  beats?: number[];
}

/** Missing EXIF dates sort after dated media, with filename and original selection as stable fallbacks. */
export function sortMedia(
  assets: readonly MediaAsset[],
  order: SlideshowOptions["order"],
): MediaAsset[] {
  if (order === "selection") return [...assets];
  const date = (asset: MediaAsset) => {
    const value = Date.parse(asset.capturedAt ?? asset.fileDate ?? "");
    return Number.isFinite(value) ? value : Infinity;
  };
  return [...assets].sort(
    (a, b) =>
      (order === "date" ? date(a) - date(b) : 0) ||
      a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
}

// Time O(scenes × 32), space O(scenes). Binary search accounts for short-neighbour transition clamping.
function fitPhotos(
  scenes: Scene[],
  assets: Project["assets"],
  target: number,
): Scene[] {
  const isPhoto = (scene: Scene) =>
    !!scene.assetId && assets[scene.assetId].kind === "image";
  let low = 0.25;
  let high = 120;
  const candidate = (seconds: number) =>
    scenes.map((scene) =>
      isPhoto(scene) ? { ...scene, duration: seconds } : scene,
    );
  if (
    target < filmDuration(candidate(low)) - 0.01 ||
    target > filmDuration(candidate(high)) + 0.01
  )
    throw new Error(
      "The music length cannot fit these photos between 0.25 and 120 seconds each. Choose fewer photos or a longer soundtrack.",
    );
  for (let iteration = 0; iteration < 32; iteration++) {
    const middle = (low + high) / 2;
    if (filmDuration(candidate(middle)) < target) low = middle;
    else high = middle;
  }
  return candidate((low + high) / 2);
}

/** Build a normal editable storyboard; themes never flatten the user's photos into an opaque template. */
export function buildSlideshow(
  project: Project,
  options: SlideshowOptions,
): Project {
  const theme = THEMES[options.theme];
  const assets = sortMedia(
    options.assetIds
      .map((id) => project.assets[id])
      .filter(
        (asset) =>
          asset &&
          ["image", "video"].includes(asset.kind) &&
          !asset.isOriginalOnly &&
          !asset.isProxy,
      ),
    options.order,
  );
  if (!assets.length)
    throw new Error("Choose photos or clips for the slideshow");
  const motions: Scene["transform"]["motion"][] = [
    "zoom-in",
    "pan-right",
    "zoom-out",
    "pan-left",
  ];
  let scenes: Scene[] = assets.map((asset, index) => {
    const scene = createScene(asset);
    return {
      ...scene,
      duration: asset.kind === "image" ? options.seconds : scene.duration,
      background: theme.background,
      captionStyle: theme.style,
      transition: theme.transition,
      transitionSeconds: theme.seconds,
      fit: project.defaults.fit,
      transform: {
        ...scene.transform,
        motion:
          options.motion && asset.kind === "image"
            ? motions[index % motions.length]
            : "none",
      },
      caption:
        options.dateCaptions && asset.capturedAt
          ? new Date(asset.capturedAt).toLocaleDateString("en-GB", {
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })
          : "",
    } satisfies Scene;
  });
  if (options.title.trim())
    scenes.unshift({
      ...createScene(null),
      caption: options.title.trim(),
      captionStyle: theme.style,
      background: theme.background,
      transition: theme.transition,
      transitionSeconds: theme.seconds,
      duration: 3,
    });
  if (options.fitSeconds)
    scenes = fitPhotos(scenes, project.assets, options.fitSeconds);
  if (options.beats?.length) {
    let position = 0;
    scenes = scenes.map((scene) => {
      const next = options.beats!.find(
        (beat) => beat >= position + scene.duration - 0.25,
      );
      const duration =
        next && next - position <= scene.duration + 0.5
          ? Math.max(0.25, next - position)
          : scene.duration;
      position += duration;
      return { ...scene, duration };
    });
  }
  return parseProject({
    ...project,
    scenes,
    subtitles: [],
    markers: [],
    name: options.title.trim() || theme.name,
  });
}
