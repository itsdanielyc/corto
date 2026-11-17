import {
  parseProject,
  type MediaAsset,
  type Project,
  type Scene,
} from "../../contracts/project";
import { createScene } from "./project";
import { buildTimeline, filmDuration } from "./timeline";
import { transitionOverlap } from "./composition";
import { createAudioClip } from "./audio";

export const THEMES = {
  family: {
    name: "Family album",
    background: "#151517",
    style: "classic",
    transition: "dissolve",
    seconds: 0.6,
    look: "warm",
    music: "music-01",
  },
  holiday: {
    name: "Holiday",
    background: "#183d45",
    style: "modern",
    transition: "slide-left",
    seconds: 0.5,
    look: "vivid",
    music: "music-09",
  },
  birthday: {
    name: "Birthday",
    background: "#69294e",
    style: "modern",
    transition: "zoom",
    seconds: 0.4,
    look: "vivid",
    music: "music-12",
  },
  memorial: {
    name: "In loving memory",
    background: "#24252a",
    style: "classic",
    transition: "dissolve",
    seconds: 1,
    look: "faded",
    music: "music-15",
  },
  wedding: {
    name: "Wedding",
    background: "#e8e5dd",
    style: "classic",
    transition: "fade-white",
    seconds: 0.8,
    look: "warm",
    music: "music-13",
  },
} as const;
export interface SlideshowOptions {
  musicAssetId?: string | null;
  musicOffset?: number;
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

// Time O(scenes log beats), space O(scenes + beats). Neighbour overlap checks preserve the exact soundtrack endpoint.
function alignPhotosToBeats(
  scenes: Scene[],
  assets: Project["assets"],
  onsets: readonly number[],
): Scene[] {
  const beats = [...onsets].filter(Number.isFinite).sort((a, b) => a - b);
  if (!beats.length) return scenes;
  const timeline = buildTimeline(scenes);
  const result = [...scenes];
  for (let index = 1; index < result.length; index++) {
    if (
      !result[index - 1].assetId ||
      !result[index].assetId ||
      assets[result[index - 1].assetId!].kind !== "image" ||
      assets[result[index].assetId!].kind !== "image"
    )
      continue;
    const target = timeline[index].start;
    let low = 0;
    let high = beats.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (beats[middle] < target) low = middle + 1;
      else high = middle;
    }
    const nearest = [beats[low - 1], beats[low]]
      .filter((value): value is number => value !== undefined)
      .sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
    const shift = nearest - target;
    if (Math.abs(shift) > 0.5) continue;
    const first = {
      ...result[index - 1],
      duration: result[index - 1].duration + shift,
    };
    const second = {
      ...result[index],
      duration: result[index].duration - shift,
    };
    if (
      [first.duration, second.duration].some(
        (value) => value < 0.25 || value > 120,
      )
    )
      continue;
    const candidate = (position: number) =>
      position === index - 1
        ? first
        : position === index
          ? second
          : result[position];
    let safe = true;
    for (let position = Math.max(0, index - 2); position <= index; position++)
      if (
        Math.abs(
          transitionOverlap(result[position], result[position + 1]) -
            transitionOverlap(candidate(position), candidate(position + 1)),
        ) > 0.000001
      )
        safe = false;
    if (safe) {
      result[index - 1] = first;
      result[index] = second;
    }
  }
  return result;
}

function slideshowMusic(
  project: Project,
  options: Pick<SlideshowOptions, "musicAssetId" | "musicOffset">,
  duration: number,
): Project["audioClips"] {
  const previous = project.audioClips.find((clip) => clip.role === "music");
  const id =
    options.musicAssetId === undefined
      ? previous?.assetId
      : options.musicAssetId;
  if (!id) return [];
  const asset = project.assets[id];
  if (asset?.kind !== "audio")
    throw new Error("Choose an audio file for the slideshow soundtrack");
  const existing = previous?.assetId === id ? previous : null;
  return [
    {
      ...createAudioClip(asset, "music"),
      offset: options.musicOffset ?? existing?.offset ?? 0,
      start: 0,
      duration,
      loop: true,
      followFilm: true,
      volume: existing?.volume ?? 0.5,
      fadeIn: Math.min(existing?.fadeIn ?? 0.3, duration / 2),
      fadeOut: Math.min(existing?.fadeOut ?? 0.3, duration / 2),
    },
  ];
}

const TEMPLATE_CAPTIONS: Record<keyof typeof THEMES, readonly string[]> = {
  family: [
    "Family album",
    "A new chapter.",
    "Everyday magic",
    "Made with love",
  ],
  holiday: [
    "A little adventure",
    "The journey",
    "Our favourite moments",
    "Until next time.",
  ],
  birthday: [
    "Happy birthday!",
    "The good times",
    "Make a wish",
    "Made with love",
  ],
  memorial: [
    "In loving memory",
    "A life remembered",
    "Stories we will keep",
    "Forever in our hearts",
  ],
  wedding: [
    "Our wedding",
    "Before the day",
    "The celebration",
    "With love, always",
  ],
};
export const projectTemplateCaptions = (
  theme: keyof typeof THEMES,
): readonly string[] => TEMPLATE_CAPTIONS[theme];
/** Editable chapter/title structures also work before any photos have been imported. */
export function buildProjectTemplate(
  project: Project,
  themeId: keyof typeof THEMES,
  title: string,
  musicAssetId?: string | null,
): Project {
  const theme = THEMES[themeId];
  const scenes = TEMPLATE_CAPTIONS[themeId].map((caption, index) => ({
    ...createScene(null),
    caption: index === 0 && title.trim() ? title.trim() : caption,
    captionStyle: theme.style,
    background: theme.background,
    transition: theme.transition,
    transitionSeconds: theme.seconds,
    duration: index === 0 ? 3 : 4,
  }));
  return parseProject({
    ...project,
    name: title.trim() || theme.name,
    scenes,
    audioClips: slideshowMusic(project, { musicAssetId }, filmDuration(scenes)),
    subtitles: [],
    markers: [],
  });
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
      adjustments: { ...scene.adjustments, look: theme.look },
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
  if (options.beats?.length)
    scenes = alignPhotosToBeats(scenes, project.assets, options.beats);
  return parseProject({
    ...project,
    scenes,
    audioClips: slideshowMusic(project, options, filmDuration(scenes)),
    subtitles: [],
    markers: [],
    name: options.title.trim() || theme.name,
  });
}
