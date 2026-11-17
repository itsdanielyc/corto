export const LOCAL_MODELS = {
  background: {
    id: "nfa04/u2netp-onnx",
    revision: "8e72726f035efc3d1918c96b020d536f2b69ba0c",
    name: "U²-Net Small",
    download: "about 5 MB",
    licence: "Apache 2.0",
    sha256: "309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8",
  },
  speech: {
    id: "onnx-community/whisper-tiny",
    revision: "ff4177021cc41f7db950912b73ea4fdf7d01d8e7",
    name: "Whisper Tiny",
    download: "about 80 MB",
    licence: "Apache 2.0",
  },
} as const;
export type LocalModelKind = keyof typeof LOCAL_MODELS;
export interface ModelProgress {
  message: string;
  fraction: number | null;
}
export type ModelJob =
  | { kind: "background"; image: Blob }
  | { kind: "speech"; samples: Float32Array; language: "en" | "es" };
export interface TranscriptChunk {
  text: string;
  timestamp: [number, number | null];
}
export type ModelResult = { image: Blob } | { chunks: TranscriptChunk[] };
