export interface RecordingFormat {
  mime: string;
  extension: "mp4" | "webm";
  label: "MP4" | "WebM";
}

const recordingFormats: readonly RecordingFormat[] = [
  {
    mime: "video/mp4;codecs=avc1.42E028,mp4a.40.2",
    extension: "mp4",
    label: "MP4",
  },
  { mime: "video/webm;codecs=vp8,opus", extension: "webm", label: "WebM" },
];

/** Detect the actual encoder instead of advertising an output the browser cannot produce. */
export function browserRecordingFormat(): RecordingFormat | null {
  if (
    typeof MediaRecorder === "undefined" ||
    typeof HTMLCanvasElement.prototype.captureStream !== "function"
  )
    return null;
  return (
    recordingFormats.find((format) =>
      MediaRecorder.isTypeSupported(format.mime),
    ) ?? null
  );
}
