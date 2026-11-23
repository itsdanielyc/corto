import type { Preferences } from "../../contracts/project";
import type { CortoPlatform } from "./types";

/** Order device preference writes and subsequent reads across Settings and film changes. */
export function createPreferenceStore(
  platform: Pick<CortoPlatform, "loadPreferences" | "savePreferences">,
) {
  let pending = Promise.resolve();
  let unsavedWrites = 0;
  return {
    settled: () => pending,
    hasPendingWrites: () => unsavedWrites > 0,
    async load() {
      await pending;
      return platform.loadPreferences?.();
    },
    save(preferences: Preferences) {
      unsavedWrites++;
      const write = pending
        .then(() => platform.savePreferences?.(preferences))
        .finally(() => {
          unsavedWrites--;
        });
      // The caller receives its own failure. Later edits can still be written.
      pending = write.catch(() => {});
      return write;
    },
  };
}

export type PreferenceStore = ReturnType<typeof createPreferenceStore>;
