import type { Locator, Page } from "@playwright/test";

interface NativeExportWatch {
  completion: Promise<void>;
  dispose(): void;
}
declare global {
  interface Window {
    cortoExportWatch?: NativeExportWatch;
  }
}

/** Await the real finite export job within the existing test budget, before asserting its presentation. */
export async function completeNativeExport(
  page: Page,
  trigger: Locator,
): Promise<void> {
  await page.evaluate(() => {
    const bridge = window.electronBridge;
    if (!bridge)
      throw new Error(
        "Native export completion requires the real preload bridge",
      );
    let resolveCompletion: () => void = () => undefined;
    let rejectCompletion: (error: Error) => void = () => undefined;
    const completion = new Promise<void>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });
    let unsubscribe: () => void = () => undefined;
    const observer = new MutationObserver(() => {
      const failure = document.querySelector('.export-dialog [role="alert"]');
      if (!failure?.textContent) return;
      dispose();
      rejectCompletion(new Error(failure.textContent));
    });
    const dispose = () => {
      unsubscribe();
      observer.disconnect();
    };
    unsubscribe = bridge.onExportProgress((progress) => {
      if (progress.fraction >= 1) {
        dispose();
        resolveCompletion();
      }
    });
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    void completion.catch(() => undefined);
    window.cortoExportWatch = { completion, dispose };
  });
  try {
    await trigger.click();
    await page.evaluate(async () => {
      if (!window.cortoExportWatch)
        throw new Error("The native export watcher was not registered");
      await window.cortoExportWatch.completion;
    });
  } finally {
    await page
      .evaluate(() => {
        window.cortoExportWatch?.dispose();
        delete window.cortoExportWatch;
      })
      .catch(() => undefined);
  }
}
