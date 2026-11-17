import type { CreatorSceneInput } from "./ffmpeg-scene";
import { tempoFilters } from "./ffmpeg-filters";

/** Audio-only exports decode no pictures and use lossless PCM between edits and the final encoder. */
export function audioSceneArguments(input: CreatorSceneInput): string[] {
  const { scene, project, localStart, duration } = input;
  const args: string[] = [];
  const filters: string[] = [];
  const tracks: string[] = [];
  let count = 0;
  const add = (
    assetId: string,
    start: number,
    span: number,
    delay: number,
    speed: number,
    pitch: boolean,
    volume: number,
    fadeIn: number,
    fadeOut: number,
    loop: boolean,
  ) => {
    const asset = project.assets[assetId];
    if (!input.audio.has(assetId) || volume <= 0 || span <= 0) return;
    const index = count++;
    if (loop) args.push("-stream_loop", "-1");
    args.push(
      "-ss",
      String(loop ? start % asset.duration : start),
      "-t",
      String(span * speed),
      "-i",
      input.path(assetId),
    );
    const fade =
      scene.transition === "fade"
        ? Math.min(scene.transitionSeconds, scene.duration / 2)
        : 0;
    const phase = localStart + delay;
    const gain = `${volume}*clip(min(${fadeIn ? `(t+${phase})/${fadeIn}` : "1"},${fadeOut ? `(${scene.duration - phase}-t)/${fadeOut}` : "1"}),0,1)${fade ? `*clip(min((t+${phase})/${fade},(${scene.duration - phase}-t)/${fade}),0,1)` : ""}`;
    const name = `a${index}`;
    filters.push(
      `[${index}:a]aresample=48000,asetpts=PTS-STARTPTS,${[...tempoFilters(speed, pitch), `atrim=duration=${span}`, `volume='${gain}':eval=frame`, `adelay=${Math.round(delay * 1000)}:all=1`, "apad", `atrim=duration=${duration}`].join(",")}[${name}]`,
    );
    tracks.push(name);
  };
  if (scene.assetId && project.assets[scene.assetId].kind === "video")
    add(
      scene.assetId,
      scene.start + localStart * scene.speed,
      duration,
      0,
      scene.speed,
      scene.preservePitch,
      scene.volume,
      scene.audioFadeIn,
      scene.audioFadeOut,
      scene.loop,
    );
  for (const layer of scene.layers)
    if (layer.assetId && project.assets[layer.assetId].kind === "video") {
      const delay = Math.max(0, layer.start - localStart);
      const span =
        Math.min(duration, (layer.end ?? scene.duration) - localStart) - delay;
      add(
        layer.assetId,
        layer.sourceStart + Math.max(0, localStart - layer.start),
        span,
        delay,
        1,
        true,
        layer.volume,
        0,
        0,
        layer.loop,
      );
    }
  if (!tracks.length) {
    args.push("-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo`);
    tracks.push("silence");
    filters.push(`[0:a]atrim=duration=${duration}[silence]`);
  }
  filters.push(
    `${tracks.map((name) => `[${name}]`).join("")}amix=inputs=${tracks.length}:normalize=0:duration=longest,alimiter=limit=0.95:level=false,atrim=duration=${duration}[sound]`,
  );
  return [
    ...args,
    "-filter_complex_threads",
    "1",
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[sound]",
    "-vn",
    "-t",
    String(duration),
    "-c:a",
    "pcm_s16le",
    "-ar",
    "48000",
    "-ac",
    "2",
    input.output,
  ];
}
