/** Browser scans are bounded; native FFmpeg subsequently probes the actual stream. */
export const PHONE_HEADER_BYTES = 4 * 1024 * 1024;
export const BROWSER_CONVERSION_BYTES = 256 * 1024 * 1024;
export const MAX_PHOTO_PIXELS = 64_000_000;
export const HDR_TO_SDR_FILTER =
  "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p";

/** Only fixed filter/codec arguments are emitted; filenames travel as separate arguments. */
export function phoneVideoArguments(
  source: string,
  destination: string,
  hdr: boolean,
): string[] {
  const scale = "scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1";
  return [
    "-protocol_whitelist",
    "file,pipe",
    "-i",
    source,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    hdr ? `${HDR_TO_SDR_FILTER},${scale}` : `${scale},format=yuv420p`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-threads",
    "2",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-metadata:s:v:0",
    "rotate=0",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-movflags",
    "+faststart",
    destination,
  ];
}

/** Inspect both ends because phone MP4 metadata can follow its encoded video data. */
export async function needsPhoneConversion(file: File): Promise<boolean> {
  if (!/\.(mp4|mov|m4v)$/i.test(file.name)) return false;
  const head = new Uint8Array(
    await file.slice(0, PHONE_HEADER_BYTES).arrayBuffer(),
  );
  const tail =
    file.size > PHONE_HEADER_BYTES
      ? new Uint8Array(await file.slice(-PHONE_HEADER_BYTES).arrayBuffer())
      : new Uint8Array();
  const decoder = new TextDecoder("latin1");
  return /hvc1|hev1|dvh1|dvhe/.test(
    decoder.decode(head) + decoder.decode(tail),
  );
}
