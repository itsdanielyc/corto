export interface Encoder {
  name: string;
  threads: number;
  quality: number;
  preset?: "veryfast" | "ultrafast";
}
export interface StagedRaster {
  path: string;
  width: number;
  height: number;
}
export interface AssetPaths {
  assetPath(id: string): string;
}
