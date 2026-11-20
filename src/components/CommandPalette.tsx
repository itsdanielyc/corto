import { useT } from "../i18n/locale";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CornerDownLeft, Search } from "lucide-react";

export interface Command {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
}

/** Most relevant commands shown before anything is typed. */
const MAX_RESULTS = 40;

/**
 * Case-insensitive match on words: every typed word must start a word in the
 * label or appear inside it. Returns the matched ranges for highlighting.
 * O(w·l) per command for w typed words and label length l.
 */
function match(label: string, query: string): [number, number][] | null {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const lower = label.toLocaleLowerCase();
  const ranges: [number, number][] = [];
  for (const word of words) {
    const index = lower.indexOf(word);
    if (index < 0) return null;
    ranges.push([index, index + word.length]);
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

function Highlighted({
  text,
  ranges,
}: {
  text: string;
  ranges: [number, number][];
}) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], index) => {
    if (start < cursor) return;
    parts.push(text.slice(cursor, start));
    parts.push(<mark key={index}>{text.slice(start, end)}</mark>);
    cursor = end;
  });
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/** Ctrl/⌘ K: every action in the app, reachable by typing a few letters. */
export function CommandPalette({
  commands,
  onClose,
}: {
  commands: readonly Command[];
  onClose: () => void;
}) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  const results = useMemo(() => {
    const available = commands.filter((command) => !command.disabled);
    if (!query.trim())
      return available
        .slice(0, MAX_RESULTS)
        .map((command) => ({ command, ranges: [] as [number, number][] }));
    return available.flatMap((command) => {
      const ranges = match(t(command.label), query);
      return ranges ? [{ command, ranges }] : [];
    });
  }, [commands, query, t]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    list.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  const run = (index: number) => {
    const chosen = results[index];
    if (!chosen) return;
    onClose();
    // Let the palette close and focus return before the command opens anything.
    requestAnimationFrame(() => chosen.command.run());
  };
  let lastGroup = "";
  return createPortal(
    <dialog
      ref={dialog}
      className="command-palette"
      aria-label={t("Commands")}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="palette-search">
        <Search size={17} aria-hidden="true" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={
            results[active] ? `${listId}-${active}` : undefined
          }
          aria-label={t("Search commands")}
          placeholder={t("Type a command")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((value) => Math.min(results.length - 1, value + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((value) => Math.max(0, value - 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              run(active);
            }
          }}
        />
        <kbd>{t("Esc")}</kbd>
      </div>
      <div
        className="palette-results"
        id={listId}
        role="listbox"
        aria-label={t("Commands")}
        ref={list}
      >
        {results.map(({ command, ranges }, index) => {
          const heading = command.group !== lastGroup ? command.group : null;
          lastGroup = command.group;
          return (
            <div key={command.id} role="presentation">
              {heading && (
                <div className="palette-group" role="presentation">
                  {t(heading)}
                </div>
              )}
              <div
                id={`${listId}-${index}`}
                role="option"
                data-index={index}
                aria-selected={index === active}
                className="palette-option"
                onPointerMove={() => setActive(index)}
                onClick={() => run(index)}
              >
                <span>
                  <Highlighted text={t(command.label)} ranges={ranges} />
                </span>
                {command.shortcut && <kbd>{command.shortcut}</kbd>}
                {index === active && (
                  <CornerDownLeft
                    size={14}
                    className="palette-enter"
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          );
        })}
        {!results.length && (
          <p className="palette-empty">{t("No command matches")}</p>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
