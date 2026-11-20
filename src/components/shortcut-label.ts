/** True on Apple platforms, where shortcuts use ⌘ instead of Ctrl. */
export const isApplePlatform =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Human label for a Ctrl/⌘ shortcut, written the way each platform does. */
export function shortcutLabel(key: string, shift = false): string {
  if (isApplePlatform) return `${shift ? "⇧" : ""}⌘${key}`;
  return `Ctrl ${shift ? "Shift " : ""}${key}`;
}
