import { parseProject, type Project } from "../../contracts/project";
import { buildTimeline } from "./timeline";
import { audioSourceTime, projectAudioClips } from "./audio";

/** Export selected scene groups without changing the editor or duplicating overlapping music intervals. */
export function selectedFilm(
  project: Project,
  selected: ReadonlySet<string>,
): Project {
  const timeline = buildTimeline(project.scenes);
  const groups: { start: number; end: number; outputStart: number }[] = [];
  const scenes: Project["scenes"] = [];
  let previousIndex = -2;
  let total = 0;
  for (const [index, entry] of timeline.entries()) {
    if (!selected.has(entry.scene.id)) continue;
    if (index === previousIndex + 1) {
      const group = groups.at(-1)!;
      total += entry.end - group.end;
      group.end = entry.end;
    } else {
      if (scenes.length && !["cut", "fade"].includes(scenes.at(-1)!.transition))
        scenes[scenes.length - 1] = { ...scenes.at(-1)!, transition: "cut" };
      groups.push({ start: entry.start, end: entry.end, outputStart: total });
      total += entry.end - entry.start;
    }
    scenes.push(entry.scene);
    previousIndex = index;
  }
  if (!scenes.length)
    throw new Error("Select one or more scenes before exporting a selection");
  const audioClips = groups.flatMap((group) =>
    projectAudioClips(project).flatMap((clip) => {
      const start = Math.max(group.start, clip.start);
      const end = Math.min(group.end, clip.start + clip.duration);
      if (end <= start) return [];
      const duration = end - start;
      return [
        {
          ...clip,
          id: crypto.randomUUID(),
          start: group.outputStart + start - group.start,
          offset: audioSourceTime(
            clip,
            start,
            project.assets[clip.assetId].duration,
          ),
          duration,
          followFilm: false,
          fadeIn: Math.min(clip.fadeIn, duration / 2),
          fadeOut: Math.min(clip.fadeOut, duration / 2),
        },
      ];
    }),
  );
  const subtitles = groups.flatMap((group) =>
    project.subtitles.flatMap((cue) => {
      const start = Math.max(group.start, cue.start);
      const end = Math.min(group.end, cue.end);
      return end > start
        ? [
            {
              ...cue,
              id: crypto.randomUUID(),
              start: group.outputStart + start - group.start,
              end: group.outputStart + end - group.start,
            },
          ]
        : [];
    }),
  );
  return parseProject({
    ...project,
    name: `${project.name.slice(0, 67)} (selection)`,
    scenes,
    audioClips,
    subtitles,
    markers: [],
  });
}
