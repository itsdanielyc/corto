import { useT } from "../../i18n/locale";
import { useEffect, useState, type ReactNode } from "react";
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  translateOptions = true,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
  translateOptions?: boolean;
}) {
  const t = useT();
  return (
    <label className="field-label">
      {t(label)}
      <select
        aria-label={t(label)}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map(([id, title]) => (
          <option key={id} value={id}>
            {translateOptions ? t(title) : title}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Numeric({
  label,
  value,
  min = 0,
  max = 3600,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(String(Number(value.toFixed(3))));
  useEffect(() => setDraft(String(Number(value.toFixed(3)))), [value]);
  return (
    <label className="field-label">
      {t(label)}
      <input
        aria-label={t(label)}
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = Number(draft);
          if (draft && Number.isFinite(next) && next >= min && next <= max)
            onChange(next);
          else setDraft(String(value));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}
export function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const t = useT();
  return (
    <label className="range-label">
      {t(label)}
      <span>{Number(value.toFixed(2))}</span>
      <input
        aria-label={t(label)}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
export function Colour({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useT();
  return (
    <label className="field-label inline-field">
      {t(label)}
      <input
        aria-label={t(label)}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const t = useT();
  return (
    <label className="tool-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {t(label)}
    </label>
  );
}
export function ToolSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <section className="tool-section">
      <h3>{t(title)}</h3>
      <div className="tool-fields">{children}</div>
    </section>
  );
}
