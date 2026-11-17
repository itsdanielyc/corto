import { useEffect, useState, useSyncExternalStore } from "react";
import type { CortoPlatform } from "../platform/types";
import { ExportQueue } from "../export/queue";

/** Export lifetime belongs to the application, so closing a dialog or editing another film keeps the job intact. */
export function useExportQueue(platform: CortoPlatform) {
  const [queue] = useState(
    () =>
      new ExportQueue(
        (...args) => platform.renderMovie(...args),
        (request) => platform.disposeExport?.(request) ?? Promise.resolve(),
      ),
  );
  const jobs = useSyncExternalStore(queue.subscribe, queue.getSnapshot);
  useEffect(() => () => queue.cancelAll(), [queue]);
  return { queue, jobs, renderMovie: queue.render };
}
