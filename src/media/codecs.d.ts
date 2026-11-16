declare module "libheif-js/libheif-wasm/libheif-bundle.mjs" {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    display(
      target: ImageData,
      callback: (result: ImageData | null) => void,
    ): void;
  }
  export default function createModule(): Promise<{
    HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] };
  }>;
}
