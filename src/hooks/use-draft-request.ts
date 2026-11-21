import { useCallback, useEffect, useRef } from "react";

/** A draft may replace the editor only while the view and the request that started it are current. */
export function useDraftRequest(view: string | null = null): () => AbortSignal {
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), [view]);
  return useCallback(() => {
    request.current?.abort();
    request.current = new AbortController();
    return request.current.signal;
  }, []);
}
