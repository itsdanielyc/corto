import { useEffect, useState } from "react";

/** Keep incomplete numeric typing local; only finite committed values reach the editing model. */
export function TimingField({
  label,
  value,
  onCommit,
  min = 0,
  max = 1800,
  step = 0.01,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          const parsed = Number(draft);
          if (
            !draft.trim() ||
            !Number.isFinite(parsed) ||
            !event.currentTarget.validity.valid
          ) {
            setDraft(String(value));
            return;
          }
          if (parsed !== value) onCommit(parsed);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}
