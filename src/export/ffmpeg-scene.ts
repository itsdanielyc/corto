import { sceneRasterKey } from "./raster-scope";
import type {
  MediaAsset,
  Project,
  Scene,
  VisualLayer,
} from "../../contracts/project";
import type { StagedRaster } from "./ffmpeg-types";
import type { Encoder } from "./ffmpeg-types";
import { encoderArguments } from "./encoder-settings";
import { audioSceneArguments } from "./ffmpeg-audio-scene";
import {
  cameraFilter,
  colourFilters,
  orientationFilters,
  tempoFilters,
} from "./ffmpeg-filters";

export interface CreatorSceneInput {
  project: Project;
  scene: Scene;
  localStart: number;
  duration: number;
  frames: number;
  width: number;
  height: number;
  fps: number;
  output: string;
  bitrate: number;
  encoder: Encoder;
  rasters: ReadonlyMap<string, StagedRaster>;
  path: (id: string) => string;
  audio: ReadonlySet<string>;
  lut?: string;
}

/** A bounded scene/overlap portion is decoded directly from immutable originals. */
export function creatorSceneArguments(input: CreatorSceneInput): string[] {
  if (["m4a", "wav"].includes(input.project.output.format))
    return audioSceneArguments(input);
  const { scene, project, localStart, duration, width, height, fps } = input;
  const args: string[] = [];
  const filters: string[] = [];
  let count = 0;
  let serial = 0;
  const layerSounds: { index: number; layer: VisualLayer }[] = [];
  const label = () => `v${serial++}`;
  const addFile = (
    path: string,
    image: boolean,
    start = 0,
    loop = false,
    mime?: string,
    seconds = duration,
  ) => {
    const index = count++;
    if (image && mime !== "image/gif")
      args.push(
        "-f",
        "image2",
        "-pattern_type",
        "none",
        "-loop",
        "1",
        "-framerate",
        String(fps),
      );
    else {
      if (loop) args.push("-stream_loop", "-1");
      if (start) args.push("-ss", String(start));
    }
    args.push(
      "-t",
      String(seconds + 1 / fps),
      "-protocol_whitelist",
      "file,pipe",
      "-i",
      path,
    );
    return index;
  };
  const addMedia = (
    asset: MediaAsset,
    start = 0,
    loop = false,
    seconds = duration,
  ) =>
    addFile(
      input.path(asset.id),
      asset.kind === "image",
      loop && asset.kind === "video" ? start % asset.duration : start,
      loop,
      asset.mime,
      seconds,
    );
  const apply = (source: string, chain: string) => {
    const target = label();
    filters.push(`[${source}]${chain}[${target}]`);
    return target;
  };
  const overlay = (
    base: string,
    top: string,
    x = "0",
    y = "0",
    enable?: string,
  ) => {
    const target = label();
    filters.push(
      `[${base}][${top}]overlay=x='${x}':y='${y}':eof_action=pass:shortest=0${enable ? `:enable='${enable}'` : ""}[${target}]`,
    );
    return target;
  };
  const colourInput = count++;
  args.push(
    "-f",
    "lavfi",
    "-i",
    `color=c=0x${scene.background.slice(1)}:s=${width}x${height}:r=${fps}:d=${duration + 1 / fps}`,
  );
  let base = `${colourInput}:v`;
  const backdropRaster = input.rasters.get(`backdrop:${scene.id}`);
  if (backdropRaster) base = `${addFile(backdropRaster.path, true)}:v`;
  if (scene.backdrop.kind === "photo" && scene.backdrop.assetId) {
    const index = addMedia(project.assets[scene.backdrop.assetId], 0, true);
    base = apply(
      `${index}:v`,
      `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`,
    );
  }
  const asset = scene.assetId ? project.assets[scene.assetId] : null;
  let primaryIndex: number | null = null;
  if (asset) {
    primaryIndex = addMedia(
      asset,
      scene.start + localStart * scene.speed,
      scene.loop || asset.animated === true,
      duration * scene.speed,
    );
    let picture = apply(
      `${primaryIndex}:v`,
      [
        `setpts=(PTS-STARTPTS)/${scene.speed}`,
        `fps=${fps}`,
        `tpad=stop_mode=clone:stop_duration=${duration}`,
        ...orientationFilters(scene),
        "format=rgba",
        ...colourFilters(scene),
        ...(input.lut ? [`lut3d=file='${input.lut}'`] : []),
        ...(scene.keyColour
          ? [
              `colorkey=0x${scene.keyColour.slice(1)}:${scene.keyTolerance}:0.05`,
            ]
          : []),
      ].join(","),
    );
    if (scene.backdrop.kind === "blur") {
      const foreground = label();
      const background = label();
      filters.push(`[${picture}]split[${foreground}][${background}]`);
      base = apply(
        background,
        `scale=${Math.ceil((width * 1.08) / 2) * 2}:${Math.ceil((height * 1.08) / 2) * 2}:force_original_aspect_ratio=increase,crop=${Math.ceil((width * 1.08) / 2) * 2}:${Math.ceil((height * 1.08) / 2) * 2},gblur=sigma=${Math.min(width, height) * 0.035},crop=${width}:${height},setsar=1`,
      );
      picture = foreground;
    }
    picture = apply(
      picture,
      cameraFilter(scene, asset, width, height, fps, localStart),
    );
    base = overlay(base, picture);
  }
  const caption = input.rasters.get(`caption:${scene.id}`);
  if (caption) base = overlay(base, `${addFile(caption.path, true)}:v`);
  const clock = `(t+${localStart})`;
  for (const layer of scene.layers) {
    const end = layer.end ?? scene.duration;
    if (end <= localStart || layer.start >= localStart + duration) continue;
    const progress = `clip((${clock}-${layer.start})/${end - layer.start},0,1)`;
    const media = layer.assetId ? project.assets[layer.assetId] : null;
    const raster = input.rasters.get(
      sceneRasterKey("layer", scene.id, layer.id),
    );
    if (!media && !raster) continue;
    const index = media
      ? addMedia(
          media,
          layer.sourceStart + Math.max(0, localStart - layer.start),
          layer.loop,
        )
      : addFile(raster!.path, true);
    let top = `${index}:v`;
    if (
      media?.kind === "video" &&
      input.audio.has(media.id) &&
      layer.volume > 0
    )
      layerSounds.push({ index, layer });
    const scale = `(1+${layer.endScale - 1}*${progress})`;
    const targetWidth = `${width * layer.width}*${scale}`;
    const targetHeight = `${height * layer.height}*${scale}`;
    const baseWidth = Math.max(2, Math.round(width * layer.width));
    const baseHeight = Math.max(2, Math.round(height * layer.height));
    const chain = [
      `setpts=PTS-STARTPTS+${Math.max(0, layer.start - localStart)}/TB`,
      `tpad=stop_mode=clone:stop_duration=${duration}`,
      "format=rgba",
      ...(raster ? [`crop=iw*0.9:ih*0.9:iw*0.05:ih*0.05`] : []),
      `scale=${baseWidth}:${baseHeight}:force_original_aspect_ratio=${layer.fit === "cover" ? "increase" : "decrease"}`,
      ...(layer.fit === "cover"
        ? [`crop=${baseWidth}:${baseHeight}`]
        : [`pad=${baseWidth}:${baseHeight}:(ow-iw)/2:(oh-ih)/2:color=black@0`]),
      `scale=w='${targetWidth}':h='${targetHeight}':eval=frame`,
      ...(layer.keyColour
        ? [`colorkey=0x${layer.keyColour.slice(1)}:${layer.keyTolerance}:0.05`]
        : []),
      `rotate=${(layer.rotation * Math.PI) / 180}:c=none:ow=rotw(iw):oh=roth(ih)`,
      ...(layer.endOpacity !== null && layer.endOpacity !== layer.opacity
        ? [
            `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${layer.opacity}+${layer.endOpacity - layer.opacity}*${progress.replace("(t+", "(T+")})'`,
          ]
        : [`colorchannelmixer=aa=${layer.opacity}`]),
    ];
    top = apply(top, chain.join(","));
    const x = `${width}*(${layer.x}+${(layer.endX ?? layer.x) - layer.x}*${progress})-overlay_w/2`;
    const y = `${height}*(${layer.y}+${(layer.endY ?? layer.y) - layer.y}*${progress})-overlay_h/2`;
    base = overlay(base, top, x, y, `between(${clock},${layer.start},${end})`);
  }
  for (const item of scene.textItems) {
    const raster = input.rasters.get(sceneRasterKey("text", scene.id, item.id));
    if (!raster) continue;
    const end = item.end ?? scene.duration;
    let top = `${addFile(raster.path, true)}:v`;
    const elapsed = `(${clock}-${item.start})`;
    if (["fade", "slide", "pop"].includes(item.animation))
      top = apply(
        top,
        `format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*clip(min((T+${localStart}-${item.start})/${item.animationSeconds},(${end - localStart}-T)/${item.animationSeconds}),0,1)'`,
      );
    if (item.animation === "pop")
      top = apply(
        top,
        `scale=w='iw*(0.7+0.3*clip((t+${localStart}-${item.start})/${item.animationSeconds},0,1))':h=-1:eval=frame`,
      );
    const mask = input.rasters.get(
      sceneRasterKey("textmask", scene.id, item.id),
    );
    if (item.animation === "typewriter" && mask) {
      const maskIndex = addFile(mask.path, true);
      const reveal = apply(
        `${maskIndex}:v`,
        `format=gray,geq=lum='if(lte(lum(X,Y),254*clip((T+${localStart}-${item.start})/${item.animationSeconds},0,1)),255,0)'`,
      );
      const text = label();
      const alphaSource = label();
      filters.push(`[${top}]format=rgba,split[${text}][${alphaSource}]`);
      const alpha = apply(alphaSource, "alphaextract");
      const masked = label();
      filters.push(`[${alpha}][${reveal}]blend=all_mode=multiply[${masked}]`);
      const merged = label();
      filters.push(`[${text}][${masked}]alphamerge[${merged}]`);
      top = merged;
    }
    const x = `${width * item.x}-overlay_w/2`;
    const y =
      item.animation === "credits"
        ? `${height}-(${height}+overlay_h)*${elapsed}/${end - item.start}`
        : `${height * item.y}-overlay_h/2${item.animation === "slide" ? `+${height * 0.12}*(1-clip(${elapsed}/${item.animationSeconds},0,1))` : ""}`;
    base = overlay(base, top, x, y, `between(${clock},${item.start},${end})`);
  }
  const fade = Math.min(scene.transitionSeconds, scene.duration / 2);
  if (scene.transition === "fade" && fade > 0) {
    const black = count++;
    args.push(
      "-f",
      "lavfi",
      "-i",
      `color=c=black:s=${width}x${height}:r=${fps}:d=${duration + 1 / fps}`,
    );
    const blended = label();
    filters.push(
      `[${base}][${black}:v]blend=all_expr='A*max(0,min(1,min((T+${localStart})/${fade},(${scene.duration - localStart}-T)/${fade})))'[${blended}]`,
    );
    base = blended;
  }
  const picture = apply(base, `fps=${fps},setsar=1,format=yuv420p`);
  let sound: string;
  if (
    asset &&
    primaryIndex !== null &&
    input.audio.has(asset.id) &&
    scene.volume > 0
  ) {
    sound = apply(
      `${primaryIndex}:a`,
      [
        "aresample=48000",
        ...tempoFilters(scene.speed, scene.preservePitch),
        `volume='${scene.volume}*max(0,min(1,min(${scene.audioFadeIn ? `(t+${localStart})/${scene.audioFadeIn}` : "1"},${scene.audioFadeOut ? `(${scene.duration - localStart}-t)/${scene.audioFadeOut}` : "1"})))${scene.transition === "fade" && fade ? `*clip(min((t+${localStart})/${fade},(${scene.duration - localStart}-t)/${fade}),0,1)` : ""}':eval=frame`,
        "apad",
        `atrim=duration=${duration}`,
      ].join(","),
    );
  } else
    ((sound = apply(`${count++}:a`, `atrim=duration=${duration}`)),
      args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"));
  if (layerSounds.length) {
    const tracks = [sound];
    for (const { index, layer } of layerSounds) {
      const delay = Math.max(0, layer.start - localStart);
      const span =
        Math.min(duration, (layer.end ?? scene.duration) - localStart) - delay;
      tracks.push(
        apply(
          `${index}:a`,
          `aresample=48000,atrim=duration=${span},asetpts=PTS-STARTPTS,volume='${layer.volume}${scene.transition === "fade" && fade ? `*clip(min((t+${Math.max(localStart, layer.start)})/${fade},(${scene.duration - Math.max(localStart, layer.start)}-t)/${fade}),0,1)` : ""}':eval=frame,adelay=${Math.round(delay * 1000)}:all=1,apad,atrim=duration=${duration}`,
        ),
      );
    }
    const mixed = label();
    filters.push(
      `${tracks.map((track) => `[${track}]`).join("")}amix=inputs=${tracks.length}:duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.95:level=false[${mixed}]`,
    );
    sound = mixed;
  }
  args.push(
    "-filter_complex_threads",
    "1",
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${picture}]`,
    "-map",
    `[${sound}]`,
    "-t",
    String(duration),
    "-frames:v",
    String(input.frames),
    "-r",
    String(fps),
    ...encoderArguments(input.encoder, input.bitrate),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    input.output,
  );
  return args;
}
