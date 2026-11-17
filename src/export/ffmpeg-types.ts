export interface Encoder {
  name: string;
  threads: number;
  quality: number;
}
export interface StagedRaster {
  path: string;
  width: number;
  height: number;
}
export interface AssetPaths {
  assetPath(id: string): string;
}
