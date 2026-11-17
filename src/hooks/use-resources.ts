import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "../../contracts/project";
import { posterFromUrl } from "../media/import";
import type { CortoPlatform } from "../platform/types";

export interface MediaResource {
  url: string;
  poster: string | null;
  error?: string;
}
export type MediaResources = Readonly<Record<string, MediaResource>>;

/** Decode library posters sequentially so importing a large batch cannot exhaust decoder memory. */
export function useResources(
  platform: CortoPlatform,
  assets: Project["assets"],
) {
  const cache = useRef<Record<string, MediaResource>>({});
  const [resources, setResources] = useState<MediaResources>({});
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const asset of Object.values(assets)) {
        if (asset.isOriginalOnly || asset.isProxy || asset.kind === "lut")
          continue;
        if (cancelled) break;
        if (cache.current[asset.id]) continue;
        try {
          const url = await platform.assetUrl(asset.id);
          const poster = await posterFromUrl(asset, url);
          if (cancelled) return;
          cache.current[asset.id] = { url, poster };
        } catch (error) {
          if (cancelled) return;
          cache.current[asset.id] = {
            url: "",
            poster: null,
            error:
              error instanceof Error
                ? error.message
                : "Original media is missing",
          };
        }
        if (!cancelled) setResources({ ...cache.current });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platform, assets]);
  const clear = useCallback(() => {
    cache.current = {};
    setResources({});
    platform.releaseMediaUrls();
  }, [platform]);
  return { resources, clear };
}
